"""Tkinter-based Configurator wizard.

Design goals:
    * Zero external dependencies — ships with any Python install.
    * One tab per server, driven entirely by `schema.py` (no per-server UI code).
    * PATs are masked by default with a Show/Hide toggle.
    * "Test connection" runs on a background thread; UI stays responsive.
    * "Auto-detect proxy" fills HTTP_PROXY / HTTPS_PROXY from Windows.
    * Save writes .env atomically per server via `env_manager`.
    * On startup, existing .env values are pre-loaded so this doubles as
      the PAT-rotation UI.

Public entry point:
    launch()               -- open the wizard (blocks until user closes)
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk
import webbrowser
from tkinter import messagebox, ttk
from typing import Callable, Optional

from . import connection_tester, env_manager, paths, proxy_detector, schema


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# One-per-field UI cell — a widget + its show/hide + validate/help behaviour
# --------------------------------------------------------------------------- #

class _FieldRow:
    """Render a single schema.Field inside a parent frame."""

    def __init__(self, parent: ttk.Frame, field: schema.Field, initial: str) -> None:
        self.field = field
        self.var = tk.StringVar(value=initial or (field.default or ""))
        self._error_var = tk.StringVar(value="")

        row = ttk.Frame(parent)
        row.pack(fill="x", padx=8, pady=4)

        label = ttk.Label(row, text=field.label + ":", width=28, anchor="w")
        label.pack(side="left")
        if field.required:
            label.configure(foreground="#8B0000")

        entry_frame = ttk.Frame(row)
        entry_frame.pack(side="left", fill="x", expand=True)

        show_char = "*" if field.secret else ""
        self.entry = ttk.Entry(entry_frame, textvariable=self.var, show=show_char, width=52)
        self.entry.pack(side="left", fill="x", expand=True)
        if field.placeholder and not initial and not field.default:
            self._install_placeholder(field.placeholder)

        if field.secret:
            self._show = False
            self._toggle_btn = ttk.Button(
                entry_frame, text="Show", width=6,
                command=self._toggle_visibility,
            )
            self._toggle_btn.pack(side="left", padx=(4, 0))

        if field.help_url:
            ttk.Button(entry_frame, text="?", width=3,
                       command=lambda u=field.help_url: webbrowser.open(u)).pack(
                side="left", padx=(4, 0))

        if field.help_text:
            ttk.Label(parent, text=field.help_text, foreground="#555",
                      wraplength=560, justify="left").pack(anchor="w", padx=(40, 8))

        ttk.Label(parent, textvariable=self._error_var, foreground="#B00020",
                  wraplength=560, justify="left").pack(anchor="w", padx=(40, 8))

        self.var.trace_add("write", lambda *_: self._revalidate())

    # ---- behaviour --------------------------------------------------------- #

    def _install_placeholder(self, text: str) -> None:
        self.entry.insert(0, text)
        self.entry.configure(foreground="grey")

        def clear(_e=None):
            if self.var.get() == text:
                self.entry.delete(0, "end")
                self.entry.configure(foreground="black")

        def restore(_e=None):
            if not self.var.get():
                self.entry.insert(0, text)
                self.entry.configure(foreground="grey")

        self.entry.bind("<FocusIn>", clear)
        self.entry.bind("<FocusOut>", restore)

    def _toggle_visibility(self) -> None:
        self._show = not self._show
        self.entry.configure(show="" if self._show else "*")
        self._toggle_btn.configure(text="Hide" if self._show else "Show")

    def _revalidate(self) -> Optional[str]:
        v = self.var.get()
        if self.field.required and not v.strip():
            self._error_var.set("Required.")
            return "Required"
        if self.field.validator:
            err = self.field.validate(v)
            self._error_var.set(err or "")
            return err
        self._error_var.set("")
        return None

    @property
    def value(self) -> str:
        v = self.var.get().strip()
        # Filter out placeholder residuals
        if self.field.placeholder and v == self.field.placeholder:
            return ""
        return v


# --------------------------------------------------------------------------- #
# Per-server tab
# --------------------------------------------------------------------------- #

class _ServerTab(ttk.Frame):
    def __init__(self, parent, spec: schema.ServerSpec) -> None:
        super().__init__(parent, padding=10)
        self.spec = spec
        self._rows: dict[str, _FieldRow] = {}

        initial = env_manager.read_env(paths.env_file_for(spec.key))

        # ---- Header (pinned top) -------------------------------------------
        header = ttk.Frame(self)
        header.pack(side="top", fill="x", pady=(0, 8))
        ttk.Label(header, text=spec.display_name,
                  font=("Segoe UI", 12, "bold")).pack(side="left")
        self._status_pill = ttk.Label(header, text="  Not tested  ",
                                      background="#DDDDDD", padding=(8, 2))
        self._status_pill.pack(side="right")

        # ---- Action bar (pinned bottom, packed BEFORE the scroll area so it
        #      always reserves space and never gets pushed off-screen). ------
        actions = ttk.Frame(self)
        actions.pack(side="bottom", fill="x", pady=(10, 0))
        ttk.Button(actions, text="Auto-detect proxy",
                   command=self._autodetect_proxy).pack(side="left")
        ttk.Button(actions, text="Test connection",
                   command=self._test_connection).pack(side="left", padx=(6, 0))
        ttk.Button(actions, text="Save", command=self._save).pack(side="right")
        ttk.Button(actions, text="Reset to defaults",
                   command=self._reset).pack(side="right", padx=(0, 6))

        # ---- Scrollable body ------------------------------------------------
        body = ttk.Frame(self)
        body.pack(side="top", fill="both", expand=True)

        self._canvas = tk.Canvas(body, highlightthickness=0, borderwidth=0)
        vsb = ttk.Scrollbar(body, orient="vertical", command=self._canvas.yview)
        self._canvas.configure(yscrollcommand=vsb.set)
        self._canvas.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")

        self._inner = ttk.Frame(self._canvas)
        self._window_id = self._canvas.create_window(
            (0, 0), window=self._inner, anchor="nw",
        )

        # Keep scrollregion & inner-width in sync with the canvas.
        self._inner.bind(
            "<Configure>",
            lambda _e: self._canvas.configure(scrollregion=self._canvas.bbox("all")),
        )
        self._canvas.bind(
            "<Configure>",
            lambda e: self._canvas.itemconfigure(self._window_id, width=e.width),
        )

        # Bind the mouse wheel *only while the pointer is over this tab* so
        # scrolling doesn't leak into other widgets or other tabs.
        self._inner.bind("<Enter>", self._bind_wheel)
        self._inner.bind("<Leave>", self._unbind_wheel)

        # ---- Categories → sections (inside the scrollable inner frame) ----
        for cat in schema.categories_of(spec):
            self._render_category(cat, initial)

    # ---- rendering --------------------------------------------------------- #

    def _render_category(self, category: str, initial: dict[str, str]) -> None:
        box = ttk.LabelFrame(self._inner, text=category, padding=(4, 4))
        box.pack(fill="x", pady=4, padx=2)
        for f in self.spec.fields:
            if f.category != category:
                continue
            row = _FieldRow(box, f, initial.get(f.key, ""))
            self._rows[f.key] = row

    # ---- scrolling --------------------------------------------------------- #

    def _bind_wheel(self, _event=None) -> None:
        # Windows / macOS deliver <MouseWheel>; Linux uses Button-4/5.
        self._canvas.bind_all("<MouseWheel>", self._on_wheel)
        self._canvas.bind_all("<Button-4>", self._on_wheel_linux_up)
        self._canvas.bind_all("<Button-5>", self._on_wheel_linux_down)

    def _unbind_wheel(self, _event=None) -> None:
        self._canvas.unbind_all("<MouseWheel>")
        self._canvas.unbind_all("<Button-4>")
        self._canvas.unbind_all("<Button-5>")

    def _on_wheel(self, event) -> None:
        # event.delta is +/-120 per notch on Windows; divide to get scroll units.
        self._canvas.yview_scroll(int(-event.delta / 120), "units")

    def _on_wheel_linux_up(self, _event) -> None:
        self._canvas.yview_scroll(-3, "units")

    def _on_wheel_linux_down(self, _event) -> None:
        self._canvas.yview_scroll(3, "units")

    # ---- actions ----------------------------------------------------------- #

    def _current_values(self) -> dict[str, str]:
        return {key: row.value for key, row in self._rows.items()}

    def _autodetect_proxy(self) -> None:
        detected = proxy_detector.detect()
        if not detected.is_set:
            messagebox.showinfo(
                "Auto-detect proxy",
                "No system proxy was found. Leave the fields empty if you don't need one.",
            )
            return
        if "HTTP_PROXY" in self._rows and detected.http:
            self._rows["HTTP_PROXY"].var.set(detected.http)
        if "HTTPS_PROXY" in self._rows and detected.https:
            self._rows["HTTPS_PROXY"].var.set(detected.https)
        messagebox.showinfo("Auto-detect proxy",
                            f"Filled proxy fields from {detected.source}.")

    def _validate_all(self) -> list[str]:
        errors: list[str] = []
        for row in self._rows.values():
            err = row._revalidate()
            if err:
                errors.append(f"{row.field.label}: {err}")
        return errors

    def _test_connection(self) -> None:
        errors = self._validate_all()
        if errors:
            self._set_status("Fix errors first", "#F4B400")
            return
        self._set_status("Testing…", "#DDDDDD")

        values = self._current_values()

        def worker() -> None:
            result = connection_tester.test_server(self.spec.key, values)
            self.after(0, lambda: self._show_test_result(result))

        threading.Thread(target=worker, daemon=True).start()

    def _show_test_result(self, result: connection_tester.TestResult) -> None:
        colour = {
            connection_tester.Status.OK:             "#0F9D58",
            connection_tester.Status.PAT_INVALID:    "#D93025",
            connection_tester.Status.PAT_EXPIRED:    "#D93025",
            connection_tester.Status.NETWORK:        "#F4B400",
            connection_tester.Status.PROXY_REQUIRED: "#F4B400",
            connection_tester.Status.CERT_ERROR:     "#F4B400",
            connection_tester.Status.UNKNOWN:        "#8A8A8A",
        }[result.status]
        text = f"  {result.status.value}  "
        self._set_status(text, colour)

        if result.is_ok:
            who = f"\nAuthenticated as: {result.display_name}" if result.display_name else ""
            messagebox.showinfo(self.spec.display_name,
                                f"{result.message}{who}")
        else:
            hint = f"\n\nHint: {result.hint}" if result.hint else ""
            messagebox.showerror(self.spec.display_name,
                                 f"{result.message}{hint}")

    def _set_status(self, text: str, background: str) -> None:
        self._status_pill.configure(text=text, background=background)

    def _save(self) -> None:
        errors = self._validate_all()
        if errors:
            messagebox.showerror(
                "Cannot save",
                "Please fix the following before saving:\n\n• " + "\n• ".join(errors),
            )
            return
        values = {k: v for k, v in self._current_values().items() if v}
        header = (
            f"MCPorsche — {self.spec.display_name}\n"
            f"Written by the Configurator wizard. Do not edit by hand while the "
            f"wizard is open. Backups live in %APPDATA%\\MCPorsche\\backups\\."
        )
        env_manager.write_env(paths.env_file_for(self.spec.key), values, header=header)
        # Offer a one-click Restart via the Control Panel instead of asking the
        # user to open a terminal.
        answer = messagebox.askyesno(
            self.spec.display_name,
            f"Saved to:\n{paths.env_file_for(self.spec.key)}\n\n"
            f"Restart the {self.spec.display_name} now so the new value takes "
            f"effect? (This opens the Control Panel where the server will "
            f"be restarted automatically.)",
        )
        if answer:
            import subprocess as _sp, sys as _sys
            _sp.Popen([_sys.executable, "-m", "mcporsche_setup", "panel"])

    def _reset(self) -> None:
        if not messagebox.askyesno(
            "Reset to defaults",
            "Clear all fields and reload defaults? Your saved .env will not be touched "
            "until you press Save.",
        ):
            return
        for key, row in self._rows.items():
            row.var.set(row.field.default or "")


# --------------------------------------------------------------------------- #
# Main window
# --------------------------------------------------------------------------- #

class Configurator(tk.Tk):
    def __init__(self, *, initial_tab: Optional[str] = None) -> None:
        super().__init__()
        self.title("MCPorsche Configurator")
        self.geometry("780x760")
        self.minsize(700, 620)
        try:
            self.iconbitmap(default="")  # placeholder — swap in your .ico when packaging
        except tk.TclError:
            pass

        self._install_style()
        self._build()
        if initial_tab:
            self._select_tab(initial_tab)

    def _install_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("vista")   # nicer on Windows than default
        except tk.TclError:
            pass
        style.configure("TLabelFrame.Label", font=("Segoe UI", 10, "bold"))
        style.configure("TButton", padding=(10, 4))

    def _build(self) -> None:
        top = ttk.Frame(self, padding=(12, 8))
        top.pack(fill="x")
        ttk.Label(top, text="MCPorsche Configurator",
                  font=("Segoe UI", 14, "bold")).pack(side="left")
        ttk.Label(top,
                  text=f"Data: {paths.DATA_ROOT}",
                  foreground="#666").pack(side="right")

        self._nb = ttk.Notebook(self)
        self._nb.pack(fill="both", expand=True, padx=8, pady=8)

        self._tabs: dict[str, _ServerTab] = {}
        for spec in schema.ALL_SERVERS:
            tab = _ServerTab(self._nb, spec)
            self._nb.add(tab, text=spec.display_name.replace(" MCP Server", ""))
            self._tabs[spec.key] = tab

        # Footer
        footer = ttk.Frame(self, padding=(12, 6))
        footer.pack(fill="x")
        ttk.Label(footer,
                  text="Secrets are stored only in local .env files and never logged.",
                  foreground="#666").pack(side="left")
        ttk.Button(footer, text="Close", command=self.destroy).pack(side="right")

    def _select_tab(self, server_key: str) -> None:
        for i, spec in enumerate(schema.ALL_SERVERS):
            if spec.key == server_key:
                self._nb.select(i)
                return


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def launch(initial_tab: Optional[str] = None) -> None:
    """Open the Configurator window and block until the user closes it."""
    paths.ensure()
    app = Configurator(initial_tab=initial_tab)
    app.mainloop()


if __name__ == "__main__":  # pragma: no cover — allow python -m mcporsche_setup.configurator
    logging.basicConfig(level=logging.INFO)
    launch()

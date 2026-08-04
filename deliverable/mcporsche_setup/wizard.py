"""Multi-step Setup Wizard — installer-style Next / Back navigation.

Flow
----
    1. Welcome
    2. Choose which MCP servers to install (checkboxes)
    3. Proxy (auto-detected, editable, "Test network")
    4. Per selected server: URL + PAT (+ optional cert) + Test connection
    5. Review & Install (writes .env for every server, then auto-starts them)
    6. Done  → launches Control Panel

Design
------
    * One `_Step` subclass per page. Each page owns its own frame, layout and
      per-field validation. Base class handles Back/Next/Cancel wiring.
    * Wizard-level state lives in `WizardState` (a plain dataclass). Steps
      read/write into it. This keeps steps independent and re-orderable.
    * All steps expose `.can_go_next()` which the base class polls to
      enable/disable the Next button live.
    * On Install, we write .env files atomically via env_manager, then hand
      off to the Control Panel (started by `__main__`).
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk
import webbrowser
from dataclasses import dataclass, field
from tkinter import messagebox, ttk
from typing import Callable, Optional

from . import (connection_tester, env_manager, paths, proxy_detector, schema,
               selection_store, shortcut)


log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Wizard-level shared state
# --------------------------------------------------------------------------- #

@dataclass
class WizardState:
    selected_servers: list[str] = field(default_factory=list)
    proxy_http: str = ""
    proxy_https: str = ""
    # Per-server values keyed by env var:  values[server_key] = {"JIRA_PAT": ...}
    values: dict[str, dict[str, str]] = field(default_factory=dict)
    # Done-page choices — all user-visible checkboxes on the last step.
    create_start_menu_shortcut: bool = True
    create_desktop_shortcut: bool = True
    autostart_on_login: bool = False
    open_panel_now: bool = True
    completed: bool = False


# --------------------------------------------------------------------------- #
# Base step
# --------------------------------------------------------------------------- #

class _Step(ttk.Frame):
    title: str = "Step"
    subtitle: str = ""

    def __init__(self, wizard: "SetupWizard", state: WizardState) -> None:
        # Parent to the wizard's body frame so _show() can reliably hide us
        # via self._body.winfo_children(). Parenting to the Tk root instead
        # leaks every step into the root and none of them ever get hidden.
        super().__init__(wizard._body, padding=(24, 16))
        self.wizard = wizard
        self.state = state

    # Called each time this step becomes visible (may re-run when navigating back).
    def on_show(self) -> None: ...

    # Called when leaving this step forward — return False to block navigation.
    def on_before_next(self) -> bool:
        return True

    # Live check used to enable/disable the Next button.
    def can_go_next(self) -> bool:
        return True


# --------------------------------------------------------------------------- #
# Step 1: Welcome
# --------------------------------------------------------------------------- #

class _WelcomeStep(_Step):
    title = "Welcome to MCPorsche"
    subtitle = "This wizard will configure your MCP servers step by step."

    def __init__(self, parent, state) -> None:
        super().__init__(parent, state)
        body = ttk.Label(
            self, justify="left", wraplength=520,
            text=(
                "MCPorsche gives you fast, local access to Jira, Confluence and "
                "GitLab from AI assistants such as GitHub Copilot and Claude "
                "Code.\n\n"
                "In the next few screens you will:\n"
                "   1. Choose which MCP servers to enable.\n"
                "   2. Confirm your corporate proxy (auto-detected).\n"
                "   3. Paste the Personal Access Token (PAT) for each server.\n"
                "   4. Review and install.\n\n"
                "You can rotate a PAT any time later from the Control Panel."
            ),
        )
        body.pack(anchor="w", pady=(6, 12))
        ttk.Label(
            self, foreground="#666", wraplength=520,
            text=(
                "Secrets are stored only in local .env files under this repository. "
                "They are never sent to Microsoft, Anthropic or anyone else."
            ),
        ).pack(anchor="w")


# --------------------------------------------------------------------------- #
# Step 2: Choose servers
# --------------------------------------------------------------------------- #

class _ChooseServersStep(_Step):
    title = "Choose MCP servers"
    subtitle = "Select which integrations you need. You can enable more later."

    def __init__(self, parent, state) -> None:
        super().__init__(parent, state)
        self._vars: dict[str, tk.BooleanVar] = {}
        for spec in schema.ALL_SERVERS:
            var = tk.BooleanVar(value=True)  # default on
            self._vars[spec.key] = var
            row = ttk.Frame(self)
            row.pack(fill="x", pady=6)
            cb = ttk.Checkbutton(
                row, text=f"  {spec.display_name}",
                variable=var, command=self.wizard.refresh_nav_state,
            )
            cb.pack(side="left")
        ttk.Label(
            self, foreground="#666", wraplength=520,
            text=(
                "\nEach selected server will get its own configuration screen "
                "next. If unsure, keep them all enabled."
            ),
        ).pack(anchor="w")

    def on_before_next(self) -> bool:
        selected = [k for k, v in self._vars.items() if v.get()]
        if not selected:
            messagebox.showwarning("Choose at least one",
                                   "Please tick at least one MCP server to continue.")
            return False
        self.state.selected_servers = selected
        # Ensure per-server value dicts exist.
        for k in selected:
            self.state.values.setdefault(k, {})
        # Also rebuild the wizard's step list so per-server pages match selection.
        self.wizard.rebuild_dynamic_steps()
        return True

    def can_go_next(self) -> bool:
        return any(v.get() for v in self._vars.values())


# --------------------------------------------------------------------------- #
# Step 3: Proxy
# --------------------------------------------------------------------------- #

class _ProxyStep(_Step):
    title = "Corporate proxy"
    subtitle = "Most Porsche machines need a proxy for outbound HTTPS."

    def __init__(self, parent, state) -> None:
        super().__init__(parent, state)
        self._http_var = tk.StringVar()
        self._https_var = tk.StringVar()
        self._status = tk.StringVar(value="")

        # Auto-detect on first show.
        top = ttk.Frame(self)
        top.pack(fill="x", pady=(0, 8))
        ttk.Button(top, text="Auto-detect from Windows",
                   command=self._autodetect).pack(side="left")
        ttk.Button(top, text="Clear (no proxy)",
                   command=self._clear).pack(side="left", padx=(6, 0))

        form = ttk.LabelFrame(self, text="Proxy URLs", padding=(8, 8))
        form.pack(fill="x", pady=6)
        _labeled_entry(form, "HTTP proxy:",  self._http_var,
                       placeholder="http://http-proxy.porsche.org:3133")
        _labeled_entry(form, "HTTPS proxy:", self._https_var,
                       placeholder="http://http-proxy.porsche.org:3133")

        ttk.Label(self, textvariable=self._status,
                  foreground="#0F9D58", wraplength=520).pack(anchor="w", pady=(6, 0))

        ttk.Label(
            self, foreground="#666", wraplength=520, justify="left",
            text=("\nLeave both fields empty only if you are on a network that "
                  "reaches skyway.porsche.com directly. When in doubt, use "
                  "Auto-detect."),
        ).pack(anchor="w")

    def on_show(self) -> None:
        # Populate from state or re-run auto-detect if empty.
        if not self._http_var.get() and not self._https_var.get():
            if self.state.proxy_http or self.state.proxy_https:
                self._http_var.set(self.state.proxy_http)
                self._https_var.set(self.state.proxy_https)
            else:
                self._autodetect()

    def _autodetect(self) -> None:
        d = proxy_detector.detect()
        if d.is_set:
            self._http_var.set(d.http or "")
            self._https_var.set(d.https or "")
            self._status.set(f"Detected from {d.source}.")
        else:
            self._status.set("No proxy detected. Leave blank if you don't need one.")

    def _clear(self) -> None:
        self._http_var.set("")
        self._https_var.set("")
        self._status.set("Proxy fields cleared.")

    def on_before_next(self) -> bool:
        self.state.proxy_http = self._http_var.get().strip()
        self.state.proxy_https = self._https_var.get().strip()
        return True


# --------------------------------------------------------------------------- #
# Step 4: One page per selected server
# --------------------------------------------------------------------------- #

class _ServerStep(_Step):
    """Renders URL + PAT + optional cert + Test connection for a single server."""

    def __init__(self, parent, state, server_key: str) -> None:
        super().__init__(parent, state)
        self.spec = schema.get_server(server_key)
        self.title = f"Configure {self.spec.display_name}"
        self.subtitle = "Paste your Personal Access Token and test the connection."

        self._vars: dict[str, tk.StringVar] = {}
        self._show_secret: dict[str, bool] = {}
        self._status_var = tk.StringVar(value="Not tested yet.")
        self._status_pill: Optional[ttk.Label] = None

        # -- Connection ---------------------------------------------------- #
        box_conn = ttk.LabelFrame(self, text="Connection", padding=(8, 8))
        box_conn.pack(fill="x", pady=4)
        self._add_field(box_conn, self._base_url_field())

        # -- Auth (PAT + optional cert) ------------------------------------ #
        box_auth = ttk.LabelFrame(self, text="Authentication (Personal Access Token)", padding=(8, 8))
        box_auth.pack(fill="x", pady=4)
        for f in self._auth_fields():
            self._add_field(box_auth, f)

        # -- Test / status pill ------------------------------------------- #
        actions = ttk.Frame(self)
        actions.pack(fill="x", pady=(10, 0))
        ttk.Button(actions, text="Test connection",
                   command=self._test_connection).pack(side="left")
        self._status_pill = ttk.Label(
            actions, text="  Not tested  ", background="#DDDDDD", padding=(8, 2),
        )
        self._status_pill.pack(side="right")

        ttk.Label(self, textvariable=self._status_var,
                  wraplength=520, foreground="#333").pack(
            anchor="w", pady=(6, 0))

        ttk.Label(
            self, foreground="#666", wraplength=520, justify="left",
            text=("\nThis test authenticates your PAT against the server. "
                  "If you also use a client certificate (mTLS), fill it in "
                  "above — the running server will use both. The test itself "
                  "only validates the PAT."),
        ).pack(anchor="w")

    # ---- schema helpers --------------------------------------------------- #

    def _base_url_field(self) -> schema.Field:
        for f in self.spec.fields:
            if f.category == "Connection":
                return f
        raise RuntimeError(f"No connection field for {self.spec.key}")

    def _auth_fields(self) -> list[schema.Field]:
        return [f for f in self.spec.fields if f.category == "Auth"]

    # ---- rendering -------------------------------------------------------- #

    def _add_field(self, parent: ttk.Widget, f: schema.Field) -> None:
        existing = self.state.values.get(self.spec.key, {}).get(f.key, "")
        var = tk.StringVar(value=existing or (f.default or ""))
        self._vars[f.key] = var
        self._show_secret[f.key] = False

        row = ttk.Frame(parent)
        row.pack(fill="x", pady=3)
        label = ttk.Label(row, text=f.label + ":", width=30, anchor="w")
        label.pack(side="left")

        # For required fields, colour the label red *only while empty*.
        # Once the user types anything the label returns to normal.
        if f.required:
            def _refresh_label_colour(*_, _label=label, _var=var):
                _label.configure(
                    foreground=("#8B0000" if not _var.get().strip() else "#222222"),
                )
            _refresh_label_colour()
            var.trace_add("write", _refresh_label_colour)

        show_char = "*" if f.secret else ""
        entry = ttk.Entry(row, textvariable=var, width=42, show=show_char)
        entry.pack(side="left", fill="x", expand=True)
        var.trace_add("write", lambda *_: self.wizard.refresh_nav_state())

        if f.secret:
            btn = ttk.Button(row, text="Show", width=6)
            btn.pack(side="left", padx=(4, 0))

            def toggle(k=f.key, e=entry, b=btn):
                self._show_secret[k] = not self._show_secret[k]
                e.configure(show="" if self._show_secret[k] else "*")
                b.configure(text="Hide" if self._show_secret[k] else "Show")

            btn.configure(command=toggle)

        if f.help_url:
            ttk.Button(row, text="Get PAT →", width=10,
                       command=lambda u=f.help_url: webbrowser.open(u)).pack(
                side="left", padx=(4, 0))

        if f.help_text:
            ttk.Label(parent, text=f.help_text, foreground="#555",
                      wraplength=520).pack(anchor="w", padx=(30, 0))

    # ---- lifecycle -------------------------------------------------------- #

    def on_show(self) -> None:
        # Ensure state has a dict for this server (in case ordering changed).
        self.state.values.setdefault(self.spec.key, {})

    def _current(self) -> dict[str, str]:
        return {k: v.get().strip() for k, v in self._vars.items() if v.get().strip()}

    def can_go_next(self) -> bool:
        cur = self._current()
        for f in self.spec.fields:
            if f.required and not cur.get(f.key):
                return False
        return True

    def on_before_next(self) -> bool:
        cur = self._current()
        # Fold in proxy for the connection tester and for later .env writing.
        cur.setdefault("HTTP_PROXY", self.state.proxy_http)
        cur.setdefault("HTTPS_PROXY", self.state.proxy_https)
        self.state.values[self.spec.key] = cur
        return True

    # ---- test ------------------------------------------------------------- #

    def _test_connection(self) -> None:
        cur = self._current()
        cur["HTTP_PROXY"] = self.state.proxy_http
        cur["HTTPS_PROXY"] = self.state.proxy_https

        self._status_var.set("Testing PAT authentication…")
        self._set_pill("  Testing…  ", "#DDDDDD")

        def worker():
            result = connection_tester.test_server(self.spec.key, cur, timeout=8.0)
            self.after(0, lambda: self._show_result(result))

        threading.Thread(target=worker, daemon=True).start()

    def _show_result(self, r: connection_tester.TestResult) -> None:
        colour_map = {
            connection_tester.Status.OK:             "#0F9D58",
            connection_tester.Status.PAT_INVALID:    "#D93025",
            connection_tester.Status.PAT_EXPIRED:    "#D93025",
            connection_tester.Status.NETWORK:        "#F4B400",
            connection_tester.Status.PROXY_REQUIRED: "#F4B400",
            connection_tester.Status.CERT_ERROR:     "#F4B400",
            connection_tester.Status.UNKNOWN:        "#8A8A8A",
        }
        self._set_pill(f"  {r.status.value}  ", colour_map[r.status])
        if r.is_ok:
            who = f" — signed in as {r.display_name}" if r.display_name else ""
            self._status_var.set(f"✔ PAT accepted{who}.")
        else:
            hint = f"\nHint: {r.hint}" if r.hint else ""
            self._status_var.set(f"✖ {r.message}{hint}")

    def _set_pill(self, text: str, colour: str) -> None:
        if self._status_pill is not None:
            self._status_pill.configure(text=text, background=colour)


# --------------------------------------------------------------------------- #
# Step 5: Review & Install
# --------------------------------------------------------------------------- #

class _ReviewStep(_Step):
    title = "Review & Install"
    subtitle = "Verify your settings, then click Install."

    def __init__(self, parent, state) -> None:
        super().__init__(parent, state)
        self._text = tk.Text(self, height=20, wrap="word",
                             font=("Consolas", 10), relief="flat",
                             background="#F7F7F7")
        self._text.pack(fill="both", expand=True)
        self._text.configure(state="disabled")

    def on_show(self) -> None:
        self._text.configure(state="normal")
        self._text.delete("1.0", "end")
        lines = ["Summary of your configuration", "=" * 40, ""]
        lines.append(f"Enabled servers: {', '.join(self.state.selected_servers)}")
        lines.append(f"HTTP proxy:  {self.state.proxy_http or '(none)'}")
        lines.append(f"HTTPS proxy: {self.state.proxy_https or '(none)'}")
        lines.append("")
        for key in self.state.selected_servers:
            spec = schema.get_server(key)
            values = self.state.values.get(key, {})
            lines.append(f"── {spec.display_name} ──")
            for f in spec.fields:
                if f.category in ("Proxy", "Advanced"):
                    continue
                v = values.get(f.key, "")
                if f.secret and v:
                    v = env_manager.redact(v)
                lines.append(f"  {f.label:32s} {v or '(not set)'}")
            lines.append(f"  Port                              {spec.default_port}")
            lines.append("")
        lines.append("Click Install to write .env files and start the servers.")
        self._text.insert("1.0", "\n".join(lines))
        self._text.configure(state="disabled")

    # This step is the last "config" step — the wizard replaces Next with
    # Install on the base class using `is_install_step`.


# --------------------------------------------------------------------------- #
# Step 6: Done
# --------------------------------------------------------------------------- #

class _DoneStep(_Step):
    title = "All done"
    subtitle = "Your MCP servers are configured."

    def __init__(self, parent, state) -> None:
        super().__init__(parent, state)
        ttk.Label(
            self, wraplength=520, justify="left",
            text=(
                "✔ .env files written under the corresponding server folder.\n"
                "✔ Endpoints registered in VS Code and Claude Desktop.\n"
            ),
        ).pack(anchor="w", pady=(6, 12))

        # ---- Shortcuts group -------------------------------------------- #
        shortcuts_box = ttk.LabelFrame(self, text="Shortcuts", padding=(8, 6))
        shortcuts_box.pack(fill="x", pady=(0, 8))

        self._start_menu_var = tk.BooleanVar(value=state.create_start_menu_shortcut)
        ttk.Checkbutton(
            shortcuts_box,
            text="Add a Start Menu shortcut",
            variable=self._start_menu_var,
            command=self._sync,
        ).pack(anchor="w")

        self._desktop_var = tk.BooleanVar(value=state.create_desktop_shortcut)
        ttk.Checkbutton(
            shortcuts_box,
            text="Add a Desktop shortcut",
            variable=self._desktop_var,
            command=self._sync,
        ).pack(anchor="w")

        # ---- Launch behaviour ------------------------------------------- #
        launch_box = ttk.LabelFrame(self, text="Launch behaviour", padding=(8, 6))
        launch_box.pack(fill="x", pady=(0, 12))

        self._open_now_var = tk.BooleanVar(value=state.open_panel_now)
        ttk.Checkbutton(
            launch_box,
            text="Open the Control Panel now",
            variable=self._open_now_var,
            command=self._sync,
        ).pack(anchor="w")

        self._autostart_var = tk.BooleanVar(value=state.autostart_on_login)
        ttk.Checkbutton(
            launch_box,
            text="Start the Control Panel automatically when I log in",
            variable=self._autostart_var,
            command=self._sync,
        ).pack(anchor="w")

        ttk.Label(
            self, foreground="#666", wraplength=520, justify="left",
            text=("You can rotate PATs, stop/start each server or view logs from "
                  "the Control Panel any time. Closing the Control Panel does "
                  "NOT stop the servers — they keep running in the background."),
        ).pack(anchor="w")

    def _sync(self) -> None:
        self.state.create_start_menu_shortcut = self._start_menu_var.get()
        self.state.create_desktop_shortcut = self._desktop_var.get()
        self.state.open_panel_now = self._open_now_var.get()
        self.state.autostart_on_login = self._autostart_var.get()


# --------------------------------------------------------------------------- #
# The wizard shell
# --------------------------------------------------------------------------- #

class SetupWizard(tk.Tk):
    STATIC_BEFORE = 3   # Welcome + Choose + Proxy
    STATIC_AFTER = 2    # Review + Done  (Install is a button, not a step)

    def __init__(self,
                 on_install: Optional[Callable[[WizardState], None]] = None) -> None:
        super().__init__()
        self.title("MCPorsche — Setup")
        self.geometry("720x680")
        self.minsize(640, 600)
        self._install_style()

        self.state = WizardState()
        self._on_install = on_install
        self._steps: list[_Step] = []
        self._current = 0

        # Porsche Engineering brand bar (red strip + wordmark).
        from . import theme as _theme
        _theme.add_brand_bar(self, subtitle="SETUP")

        # Layout
        self._header = ttk.Frame(self, padding=(24, 18), style="PAG.TLabelframe")
        self._header.pack(side="top", fill="x")
        self._title_var = tk.StringVar()
        self._subtitle_var = tk.StringVar()
        ttk.Label(self._header, textvariable=self._title_var,
                  style="PAG.Title.TLabel").pack(anchor="w")
        ttk.Label(self._header, textvariable=self._subtitle_var,
                  style="PAG.Muted.TLabel").pack(anchor="w", pady=(2, 0))
        ttk.Separator(self, orient="horizontal").pack(fill="x")

        # PEG-IT footer (packed bottom first so nav bar sits above it).
        _theme.add_footer(self)

        # Nav bar pinned above the footer.
        nav = ttk.Frame(self, padding=(20, 12))
        nav.pack(side="bottom", fill="x")
        self._progress = ttk.Label(nav, text="", style="PAG.Small.TLabel")
        self._progress.pack(side="left")
        self._cancel_btn = ttk.Button(
            nav, text="Cancel", style="PAG.Ghost.TButton", command=self._cancel,
        )
        self._cancel_btn.pack(side="right", padx=(6, 0))
        self._next_btn = ttk.Button(
            nav, text="Next  ›", style="PAG.Primary.TButton", command=self._next,
        )
        self._next_btn.pack(side="right", padx=(6, 0))
        self._back_btn = ttk.Button(
            nav, text="‹  Back", style="PAG.Secondary.TButton", command=self._back,
        )
        self._back_btn.pack(side="right")

        # Body sits in the remaining space between header and nav.
        self._body = ttk.Frame(self, style="PAG.Card.TFrame")
        self._body.pack(side="top", fill="both", expand=True, padx=20, pady=12)

        # Build initial static steps.
        self._build_static_steps()
        self._show(0)

        self.after(200, self.refresh_nav_state)

    # ---- style ----------------------------------------------------------- #

    def _install_style(self) -> None:
        from . import theme
        theme.install(self)

    # ---- dynamic step composition --------------------------------------- #

    def _build_static_steps(self) -> None:
        self._steps = [
            _WelcomeStep(self, self.state),
            _ChooseServersStep(self, self.state),
            _ProxyStep(self, self.state),
            _ReviewStep(self, self.state),
            _DoneStep(self, self.state),
        ]

    def rebuild_dynamic_steps(self) -> None:
        """Insert one _ServerStep per selected server between Proxy and Review."""
        # Split the current list around the fixed positions.
        head = self._steps[:self.STATIC_BEFORE]      # Welcome, Choose, Proxy
        tail = self._steps[-self.STATIC_AFTER:]      # Review, Done
        server_steps = [
            _ServerStep(self, self.state, key)
            for key in self.state.selected_servers
        ]
        # Destroy any old server steps we're throwing away.
        for w in self._steps[self.STATIC_BEFORE:-self.STATIC_AFTER]:
            w.destroy()
        self._steps = head + server_steps + tail

    # ---- navigation ------------------------------------------------------ #

    def _show(self, idx: int) -> None:
        for w in self._body.winfo_children():
            w.pack_forget()
        step = self._steps[idx]
        step.pack(fill="both", expand=True)
        self._current = idx
        self._title_var.set(step.title)
        self._subtitle_var.set(step.subtitle)
        self._progress.configure(text=f"Step {idx + 1} of {len(self._steps)}")
        self._back_btn.configure(state=("disabled" if idx == 0 else "normal"))
        # The step just before "Done" is Review — Next becomes "Install".
        if self._is_review_step(idx):
            self._next_btn.configure(text="Install")
        elif self._is_done_step(idx):
            self._next_btn.configure(text="Finish")
            self._cancel_btn.pack_forget()
        else:
            self._next_btn.configure(text="Next  ›")
            self._cancel_btn.pack(side="right", padx=(6, 0))
        step.on_show()
        self.refresh_nav_state()

    def _next(self) -> None:
        step = self._steps[self._current]
        if not step.on_before_next():
            return

        if self._is_review_step(self._current):
            # Perform the install now, then advance to Done.
            self._perform_install()
            return

        if self._is_done_step(self._current):
            self._apply_done_options()
            self.destroy()
            return

        self._show(self._current + 1)

    def _apply_done_options(self) -> None:
        """Honour every checkbox on the Done page.

        Any failure here is surfaced as a single warning dialog but does not
        block the wizard from closing — the user's config was already written
        and their servers can still be launched manually.
        """
        locations_to_create: list[shortcut.Location] = []
        if self.state.create_start_menu_shortcut:
            locations_to_create.append(shortcut.Location.START_MENU)
        if self.state.create_desktop_shortcut:
            locations_to_create.append(shortcut.Location.DESKTOP)
        if self.state.autostart_on_login:
            locations_to_create.append(shortcut.Location.STARTUP)
        else:
            # If the user *unchecked* autostart, make sure a stale Startup
            # shortcut from a previous install is removed.
            try:
                shortcut.remove(shortcut.Location.STARTUP)
            except Exception:  # pragma: no cover
                log.exception("Failed to remove old Startup shortcut")

        failures: list[str] = []
        for loc in locations_to_create:
            try:
                info_ = shortcut.create_or_repair(loc)
                log.info("Shortcut installed at %s", info_.path)
            except Exception as e:
                failures.append(f"{loc.value}: {e}")

        if failures:
            messagebox.showwarning(
                "Shortcut",
                "One or more shortcuts could not be created:\n\n"
                + "\n".join(f"  • {f}" for f in failures)
                + "\n\nYou can still launch the Control Panel from a terminal:\n"
                "    python -m mcporsche_setup panel",
            )

    def _back(self) -> None:
        if self._current == 0:
            return
        self._show(self._current - 1)

    def _cancel(self) -> None:
        if messagebox.askyesno("Cancel setup",
                               "Discard your entries and close the wizard?"):
            self.destroy()

    def refresh_nav_state(self) -> None:
        try:
            step = self._steps[self._current]
        except IndexError:
            return
        can_next = step.can_go_next()
        self._next_btn.configure(state=("normal" if can_next else "disabled"))

    # ---- indices --------------------------------------------------------- #

    def _is_review_step(self, idx: int) -> bool:
        return idx == len(self._steps) - 2

    def _is_done_step(self, idx: int) -> bool:
        return idx == len(self._steps) - 1

    # ---- install -------------------------------------------------------- #

    def _perform_install(self) -> None:
        try:
            self._write_env_files()
        except Exception as e:
            messagebox.showerror("Install failed", f"Could not write .env files:\n{e}")
            return
        self.state.completed = True
        # Hand off to caller (control panel launcher).
        if self._on_install is not None:
            try:
                self._on_install(self.state)
            except Exception:  # pragma: no cover
                log.exception("on_install callback failed")
        self._show(self._current + 1)  # Done page

    def _write_env_files(self) -> None:
        paths.ensure()
        header = ("MCPorsche — written by the Setup Wizard.\n"
                  "Use the Control Panel or Rotate PAT in the tray to change values.")
        for key in self.state.selected_servers:
            values = dict(self.state.values.get(key, {}))
            # Inject proxy at write-time so every server gets the same values.
            if self.state.proxy_http:
                values["HTTP_PROXY"] = self.state.proxy_http
            if self.state.proxy_https:
                values["HTTPS_PROXY"] = self.state.proxy_https
            spec = schema.get_server(key)
            values.setdefault("MCP_PORT", str(spec.default_port))
            values.setdefault("MCP_TRANSPORT", "http")
            env_manager.write_env(paths.env_file_for(key), values, header=header)
        # Persist the user's selection so the Control Panel filters to it.
        selection_store.save(self.state.selected_servers)


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def _labeled_entry(parent, label_text: str, var: tk.StringVar,
                   *, placeholder: Optional[str] = None) -> ttk.Entry:
    row = ttk.Frame(parent)
    row.pack(fill="x", pady=3)
    ttk.Label(row, text=label_text, width=16, anchor="w").pack(side="left")
    entry = ttk.Entry(row, textvariable=var, width=44)
    entry.pack(side="left", fill="x", expand=True)
    if placeholder:
        def _install():
            if not var.get():
                entry.insert(0, placeholder)
                entry.configure(foreground="grey")
        def _clear(_e):
            if entry.cget("foreground") == "grey":
                entry.delete(0, "end")
                entry.configure(foreground="black")
        def _restore(_e):
            if not var.get():
                entry.insert(0, placeholder)
                entry.configure(foreground="grey")
        _install()
        entry.bind("<FocusIn>", _clear)
        entry.bind("<FocusOut>", _restore)
    return entry


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def launch(on_install: Optional[Callable[[WizardState], None]] = None) -> WizardState:
    """Open the wizard. Blocks until closed. Returns the final WizardState."""
    paths.ensure()
    wiz = SetupWizard(on_install=on_install)
    wiz.mainloop()
    return wiz.state

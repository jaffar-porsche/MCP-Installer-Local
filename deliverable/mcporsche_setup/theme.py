"""Porsche Engineering — brand tokens for the Tkinter GUIs.

These constants mirror the same palette used by the Electron edition
(``tailwind.config.ts``) so both deliverables look and feel identical.

Only the values live here; each widget applies them locally. This keeps
tkinter's ttk theming — which is famously finicky — simple and predictable.
"""
from __future__ import annotations


# --------------------------------------------------------------------------- #
# Colours
# --------------------------------------------------------------------------- #

PAG_RED = "#D5001C"
PAG_RED_HOVER = "#EE0024"
PAG_RED_DARK = "#B30017"
PAG_RED_FAINT = "#FDE9EC"

PAG_INK = "#0A0A0A"
PAG_INK_SOFT = "#171717"

PAG_BG = "#FAFAFA"
PAG_SURFACE = "#FFFFFF"
PAG_MUTED = "#F4F4F5"

PAG_BORDER = "#E4E4E7"

PAG_TEXT = "#18181B"
PAG_TEXT_MUTED = "#71717A"
PAG_TEXT_FAINT = "#A1A1AA"

PAG_SUCCESS = "#00A85A"
PAG_SUCCESS_FAINT = "#DCFCE7"
PAG_WARNING = "#F4A100"
PAG_WARNING_FAINT = "#FEF3C7"
PAG_ERROR = "#E60024"
PAG_ERROR_FAINT = "#FEE2E2"
PAG_INFO = "#0064C8"


# --------------------------------------------------------------------------- #
# Typography
# --------------------------------------------------------------------------- #

FONT_TITLE = ("Segoe UI", 15, "bold")
FONT_H1 = ("Segoe UI", 12, "bold")
FONT_H2 = ("Segoe UI", 11, "bold")
FONT_BODY = ("Segoe UI", 10)
FONT_MUTED = ("Segoe UI", 9)
FONT_SMALL = ("Segoe UI", 9)
FONT_XS = ("Segoe UI", 8)
FONT_MONO = ("Consolas", 9)


# --------------------------------------------------------------------------- #
# Attaching brand-styled ttk styles to a Tk root
# --------------------------------------------------------------------------- #

def install(root) -> None:
    """Register the PAG.* ttk styles on the given Tk root.

    Call once early in a window's __init__ before creating widgets that will
    reference them.
    """
    from tkinter import ttk
    style = ttk.Style(root)
    try:
        style.theme_use("clam")   # 'clam' respects background colours cleanly
    except Exception:  # pragma: no cover
        pass

    root.configure(background=PAG_BG)

    # ----- Buttons ------------------------------------------------------- #
    style.configure(
        "PAG.Primary.TButton",
        background=PAG_RED,
        foreground="white",
        font=FONT_BODY,
        padding=(14, 6),
        borderwidth=0,
        focusthickness=0,
    )
    style.map(
        "PAG.Primary.TButton",
        background=[("active", PAG_RED_HOVER), ("disabled", PAG_TEXT_FAINT)],
        foreground=[("disabled", "white")],
    )

    style.configure(
        "PAG.Secondary.TButton",
        background=PAG_SURFACE,
        foreground=PAG_TEXT,
        font=FONT_BODY,
        padding=(14, 6),
        borderwidth=1,
        relief="solid",
    )
    style.map(
        "PAG.Secondary.TButton",
        background=[("active", PAG_MUTED), ("disabled", PAG_MUTED)],
        foreground=[("disabled", PAG_TEXT_FAINT)],
    )

    style.configure(
        "PAG.Ghost.TButton",
        background=PAG_BG,
        foreground=PAG_TEXT,
        font=FONT_BODY,
        padding=(10, 6),
        borderwidth=0,
    )
    style.map(
        "PAG.Ghost.TButton",
        background=[("active", PAG_MUTED)],
        foreground=[("disabled", PAG_TEXT_FAINT)],
    )

    # ----- Labels / frames ---------------------------------------------- #
    style.configure("PAG.TLabel", background=PAG_BG, foreground=PAG_TEXT, font=FONT_BODY)
    style.configure("PAG.Title.TLabel", background=PAG_BG, foreground=PAG_TEXT, font=FONT_TITLE)
    style.configure("PAG.Muted.TLabel", background=PAG_BG, foreground=PAG_TEXT_MUTED, font=FONT_BODY)
    style.configure("PAG.Small.TLabel", background=PAG_BG, foreground=PAG_TEXT_MUTED, font=FONT_MUTED)
    style.configure("PAG.Card.TFrame", background=PAG_SURFACE, borderwidth=1, relief="solid")

    # ----- LabelFrame (section) ----------------------------------------- #
    style.configure(
        "PAG.TLabelframe",
        background=PAG_SURFACE,
        borderwidth=1,
        relief="solid",
        padding=8,
    )
    style.configure(
        "PAG.TLabelframe.Label",
        background=PAG_SURFACE,
        foreground=PAG_TEXT_MUTED,
        font=FONT_H2,
    )

    # ----- Entry -------------------------------------------------------- #
    style.configure(
        "PAG.TEntry",
        fieldbackground=PAG_SURFACE,
        foreground=PAG_TEXT,
        bordercolor=PAG_BORDER,
        lightcolor=PAG_BORDER,
        darkcolor=PAG_BORDER,
        padding=6,
    )
    style.map(
        "PAG.TEntry",
        bordercolor=[("focus", PAG_RED)],
        lightcolor=[("focus", PAG_RED)],
        darkcolor=[("focus", PAG_RED)],
    )

    # ----- Progress bar ------------------------------------------------- #
    style.configure(
        "PAG.Horizontal.TProgressbar",
        troughcolor=PAG_BORDER,
        background=PAG_RED,
        bordercolor=PAG_BORDER,
        lightcolor=PAG_RED,
        darkcolor=PAG_RED,
    )

    # ----- Notebook tabs (used by legacy configurator) ------------------ #
    style.configure(
        "PAG.TNotebook",
        background=PAG_BG,
        borderwidth=0,
        tabmargins=(4, 2, 4, 0),
    )
    style.configure(
        "PAG.TNotebook.Tab",
        padding=(14, 6),
        background=PAG_MUTED,
        foreground=PAG_TEXT_MUTED,
        font=FONT_BODY,
    )
    style.map(
        "PAG.TNotebook.Tab",
        background=[("selected", PAG_SURFACE)],
        foreground=[("selected", PAG_TEXT)],
    )

    # ----- Checkbutton -------------------------------------------------- #
    style.configure(
        "PAG.TCheckbutton",
        background=PAG_BG,
        foreground=PAG_TEXT,
        font=FONT_BODY,
    )


# --------------------------------------------------------------------------- #
# Reusable chrome (top bar + footer)
# --------------------------------------------------------------------------- #

def add_brand_bar(parent, subtitle: str = "") -> None:
    """Add the red brand strip + wordmark + PEG-IT corner. Idempotent."""
    import tkinter as tk
    from tkinter import ttk

    strip = tk.Frame(parent, background=PAG_RED, height=4)
    strip.pack(fill="x")

    header = tk.Frame(parent, background=PAG_SURFACE)
    header.pack(fill="x")

    left = tk.Frame(header, background=PAG_SURFACE)
    left.pack(side="left", padx=20, pady=12)
    tk.Label(left, text="MC", fg=PAG_INK, bg=PAG_SURFACE,
             font=("Segoe UI", 16, "bold")).pack(side="left")
    tk.Label(left, text="Porsche", fg=PAG_RED, bg=PAG_SURFACE,
             font=("Segoe UI", 16, "bold")).pack(side="left")
    if subtitle:
        tk.Label(left, text=f"  ·  {subtitle}", fg=PAG_TEXT_FAINT, bg=PAG_SURFACE,
                 font=("Segoe UI", 9, "bold")).pack(side="left", padx=(6, 0))

    right = tk.Frame(header, background=PAG_SURFACE)
    right.pack(side="right", padx=20, pady=12)
    tk.Label(right, text="Porsche Engineering", fg=PAG_TEXT_MUTED,
             bg=PAG_SURFACE, font=FONT_SMALL).pack(anchor="e")
    tk.Label(right, text="PEG-IT", fg=PAG_TEXT_FAINT, bg=PAG_SURFACE,
             font=("Segoe UI", 8, "bold")).pack(anchor="e")

    ttk.Separator(parent, orient="horizontal").pack(fill="x")


def add_footer(parent) -> None:
    """Add the 'Powered by PEG-IT' footer strip."""
    import tkinter as tk
    from tkinter import ttk

    ttk.Separator(parent, orient="horizontal").pack(fill="x", side="bottom")
    footer = tk.Frame(parent, background=PAG_SURFACE, height=28)
    footer.pack(fill="x", side="bottom")
    tk.Label(footer, text="Powered by PEG-IT", fg=PAG_TEXT_FAINT,
             bg=PAG_SURFACE, font=("Segoe UI", 8, "bold")).pack(side="right", padx=20, pady=6)

/** Shared listbox interaction for Studio controls. Callers own the options and values. */
export function bindDropdown(control: HTMLElement, trigger: HTMLButtonElement, menu: HTMLElement, options: readonly HTMLButtonElement[]) {
  const close = (restoreFocus = false): void => {
    control.classList.remove("open", "open-up");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    if (restoreFocus) trigger.focus();
  };
  const open = (focus: "selected" | "first" | "last" = "selected"): void => {
    control.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    control.classList.remove("open-up");
    const scroll = control.closest<HTMLElement>(".workspace-scroll");
    if (scroll !== null) {
      const menuBox = menu.getBoundingClientRect();
      const scrollBox = scroll.getBoundingClientRect();
      if (menuBox.bottom > scrollBox.bottom && trigger.getBoundingClientRect().top - menuBox.height >= scrollBox.top) {
        control.classList.add("open-up");
      }
    }
    const target = focus === "first" ? options[0]
      : focus === "last" ? options.at(-1)
      : options.find((option) => option.classList.contains("active")) ?? options[0];
    target?.focus();
  };
  const moveOptionFocus = (offset: number): void => {
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = current < 0 ? 0 : (current + offset + options.length) % options.length;
    options[next]?.focus();
  };

  trigger.addEventListener("click", () => {
    if (control.classList.contains("open")) close(false);
    else open();
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      open(event.key === "ArrowDown" ? "first" : "last");
    } else if (event.key === "Escape" && control.classList.contains("open")) {
      event.preventDefault();
      event.stopPropagation();
      close(false);
    }
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveOptionFocus(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      options[event.key === "Home" ? 0 : options.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  control.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
    close(false);
  });
  return { close };
}

export function restoreDialogFocus(target: HTMLElement | null) {
  // Switching between the book and context creates a new dialog. Its own focus
  // effect must win; an unmounted dialog's opener may no longer be connected.
  if (document.querySelector('[role="dialog"]')) return;
  if (target?.isConnected && target !== document.body && !target.closest("[inert]")) {
    target.focus();
    return;
  }
  const fallback = document.getElementById("flatworld-intro-primary")
    ?? document.querySelector<HTMLButtonElement>(".header-book-action");
  fallback?.focus();
}

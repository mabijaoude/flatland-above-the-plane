// Keep a failed module download readable without exposing exception details or
// inserting an error message as HTML. The ordinary app handles errors after boot.
window.addEventListener("error", function () {
  var shell = document.querySelector("#root .boot-shell");
  if (!shell) return;
  shell.className = "boot-error";
  shell.setAttribute("role", "alert");
  shell.replaceChildren();
  var heading = document.createElement("h1");
  heading.textContent = "Flatland could not start.";
  var explanation = document.createElement("p");
  explanation.textContent = "Please reload the page. You can still read the complete book.";
  var reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload Flatland";
  reload.addEventListener("click", function () { window.location.reload(); });
  var book = document.createElement("a");
  book.href = "/books/flatland/index.html";
  book.textContent = "Read Flatland";
  shell.append(heading, explanation, reload, book);
}, true);

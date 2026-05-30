(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form").forEach(form => {
      form.addEventListener("submit", event => {
        event.preventDefault();
        alert("This GitHub Pages version is static. Please update the matching file in the data/ folder and commit the change.");
      });
    });
  });
})();

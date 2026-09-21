/* Lembar — site configuration.
   Edit the values below, then commit this file to your repo.
   No build step needed — this is plain JavaScript read directly by the browser. */
window.LEMBAR_CONFIG = {
  // Email that receives "founderku@gmail.com" submissions from visitors (mailto link).
  // Change this to your own email address.
  adminEmail: "founderku@gmail.com",

  // Your GitHub repository, used only by admin.html to save changes.
  // Example: if your repo is https://github.com/windi-tri/lembar
  // then owner = "windi-tri" and repo = "lembar".
  github: {
    owner: "founderku",
    repo: "Lembar",
    branch: "main"
  },

  // SHA-256 hash of your admin password (NOT the password itself).
  // Open admin/generate-password-hash.html, type your password, then paste
  // the hash it shows here. Empty = admin login is not set up yet.
  adminPasswordHash: "d3e490d909eedcf5049fc8ea9adb29883f79cfeac9797ebc0c44cf92be3e2178"
};

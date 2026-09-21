/* Lembar — site configuration.
   Edit the values below, then commit this file to your repo.
   No build step needed — this is plain JavaScript read directly by the browser. */
window.LEMBAR_CONFIG = {
  // Email that receives "winditrianti389@gmail.com" submissions from visitors (mailto link).
  // Change this to your own email address.
  adminEmail: "winditrianti389@gmail.com",

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
  adminPasswordHash: "92e5e4aa902be37cbe588a757092283183e6e948b463ee0b193147fce8d65515"
};

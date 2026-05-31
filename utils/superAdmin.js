function getSuperAdminEmails() {
  // Emails listed in ADMIN_EMAILS env (comma-separated) on Vercel/host.
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isSuperAdminEmail(email) {
  if (!email) return false;
  return getSuperAdminEmails().includes(String(email).trim().toLowerCase());
}

module.exports = {
  getSuperAdminEmails,
  isSuperAdminEmail,
};

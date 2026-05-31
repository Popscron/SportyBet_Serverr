function getSuperAdminEmails() {
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

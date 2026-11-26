/* eslint-disable */
/**
 * Dynamic layer over app.json.
 *
 * Drop Firebase's config files in the project root and everything wires itself:
 *   google-services.json      → android.googleServicesFile (FCM push + Google sign-in)
 *                               + the Web OAuth client id for Google sign-in
 *   GoogleService-Info.plist  → ios.googleServicesFile
 *
 * Both files are downloaded from Firebase console → Project settings → Your apps
 * (project event-management-4fe6f). For EAS builds they can also come from EAS
 * file env vars GOOGLE_SERVICES_JSON / GOOGLE_SERVICE_INFO_PLIST.
 */
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const android = { ...(config.android || {}) };
  const ios = { ...(config.ios || {}) };
  const extra = { ...(config.extra || {}) };
  const google = { ...(extra.google || {}) };
  const firebase = { ...(extra.firebase || {}) };

  const gsPath = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, "google-services.json");
  const plistPath = process.env.GOOGLE_SERVICE_INFO_PLIST || path.join(__dirname, "GoogleService-Info.plist");

  if (fs.existsSync(gsPath)) {
    android.googleServicesFile = gsPath;
    try {
      const gs = JSON.parse(fs.readFileSync(gsPath, "utf8"));
      const clients = gs.client || [];
      const mine =
        clients.find((c) => c?.client_info?.android_client_info?.package_name === android.package) || clients[0] || {};
      const oauth = [
        ...(mine.oauth_client || []),
        ...((mine.services && mine.services.appinvite_service && mine.services.appinvite_service.other_platform_oauth_client) || []),
      ];
      // client_type 3 = the Web client — what Google sign-in needs as `webClientId`
      const web = oauth.find((o) => o && o.client_type === 3);
      if (!google.webClientId && web) google.webClientId = web.client_id;
      if (!firebase.projectId && gs.project_info) firebase.projectId = gs.project_info.project_id;
    } catch (e) {
      console.warn("[app.config] couldn't read google-services.json:", e && e.message);
    }
  }

  if (fs.existsSync(plistPath)) ios.googleServicesFile = plistPath;

  return { ...config, android, ios, extra: { ...extra, google, firebase } };
};

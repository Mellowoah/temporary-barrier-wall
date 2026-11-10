# Temporary Barrier Wall

Offline web app. `index.html` is the app; `pdf-report.js` builds the photo PDF with no network; `sw.js` and `manifest.webmanifest` enable Add to Home Screen and offline use over https.

On Finish, **Download PDF** writes a letter-size report (one page per fail) and, on iPhone, offers the system share sheet so the file can actually be saved. Photos in that PDF are the compressed thumbnails already stored on the phone (full-resolution camera files are not kept). At most 40 pages.

# Temporary Barrier Wall

Offline web app. `index.html` is the app; `pdf-report.js` builds the photo PDF and `zip-store.js` packs photo files, both with no network. `sw.js` and `manifest.webmanifest` enable Add to Home Screen and offline use over https.

On Finish, **Download PDF** writes a letter-size report (one page per fail, photo filling the page). **Download photos** saves numbered JPEGs (`Photo-01_Sta-1923+12.50.jpg`) via the share sheet or a zip. The CSV has a `Photo #` column in that same order. A larger copy of each new photo (about 1600px, JPEG 0.8) is kept in IndexedDB; the on-screen thumbnail stays small. Older entries that only have a thumbnail still export and print, using that thumbnail. At most 40 photos per PDF or photo download.

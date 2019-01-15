# Mosquitokiller zapper web frontend
Web frontend associated with [Dengue Lamps & Minimal covering circle API](https://github.com/NCKU-CCS/Mosquitokiller-Bucket-API)

# Getting start
1. Clone the project and go to project directory.

`$ git clone https://github.com/NCKU-CCS/mosquitokiller-zapper-web.git && cd mosquitokiller-zapper-web`

2. Install dependencies and run gulp.

`$ npm i && npm run start`

2. Start a local server you are used to. For exapmle:

`$ python -m http.server`

3. Enter the url of your local server in browser.

# Usage
- Modify the google map api key in `index.html` to yours

`<script async defer src="https://maps.googleapis.com/maps/api/js?key={YOUR_KEY}" type="text/javascript"></script>`

- Modify the `root_url` in `app.js` to the backend url

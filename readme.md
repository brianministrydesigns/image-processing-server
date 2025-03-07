# ministry designs platform image processor mvp

It receives, modifies, and uploads media files to our Wasabi servers and returns the URLs.

## add env vars

add `.env` file based on `.env.example`
in `.env` add the correct `WASABI_ACCESS_KEY` and `WASABI_SECRET_KEY`
the other information is already correct

## start

run `npm i`
run `npm run start`

## test frontend

to test the functionality you can go to http://localhost:3000/uploadTester

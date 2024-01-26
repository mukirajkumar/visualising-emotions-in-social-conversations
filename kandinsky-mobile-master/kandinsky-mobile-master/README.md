# Getting Started:

1. Install Node.JS.
2. Install Ionic CLI globally `npm install -g @ionic/cli`.
3. Inside the project folder, run `npm install` to install the required dependencies.
4. Serve the application in your local browser by running `ionic serve`.

# Building:

### Android

1. Build the web application via `npm run build`.
2. Copy the changes to the Android Studio project by running `npx cap copy`.
3. Open the native project in Android Studio using the command `ionic cap open android`.
4. From Android Studio, build the APK by clicking `Build` > `Build Bundle(s) / APKs` > `Build APKs`.
5. Optionally, if your Android device (with developer mode enabled) is connected, you can choose your device from dropdown list on top and click on the play button. This should deploy the app directly to your device.

### iOS

1. Build the web application using `npm run build`.
2. Copy the changes to the Xcode project using `npx cap copy`.
3. Open the native project in Xcode using the command `ionic cap open ios`.
4. With your iPhone connected, choose your phone as the target for the app and click on the play button. This should deploy the app directly to your device.
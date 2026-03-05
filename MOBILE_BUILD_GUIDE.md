# Mobile Build Guide

## Building APK for Android using Expo EAS

### Prerequisites
1. Ensure you have Node.js installed on your machine.
2. Install Expo CLI globally using:
   ```sh
   npm install -g expo-cli
   ```
3. Install EAS CLI globally using:
   ```sh
   npm install -g eas-cli
   ```
4. Authenticate your Expo account:
   ```sh
   eas login
   ```

### Step 1: Configure your app
- Open `app.json` or `app.config.js` in the root of your project and set the necessary configurations for Android.

### Step 2: Build the APK
- Run the following command in your project directory:
   ```sh
   eas build --platform android
   ```
- Follow the prompts to initiate the build process.

### Step 3: Download APK
- Once the build is complete, you will receive a link in your terminal to download the APK.
- You can also access build details from your Expo account dashboard under the "Builds" section.

## Building IPA for iOS using Expo EAS

### Prerequisites
1. Ensure you have Node.js installed on your machine.
2. Install Expo CLI globally:
   ```sh
   npm install -g expo-cli
   ```
3. Install EAS CLI globally:
   ```sh
   npm install -g eas-cli
   ```
4. Authenticate your Expo account:
   ```sh
   eas login
   ```
5. A Mac is required for building iOS apps.

### Step 1: Configure your app
- Open `app.json` or `app.config.js` and set the necessary configurations for iOS.

### Step 2: Build the IPA
- Run the following command in your project directory:
   ```sh
   eas build --platform ios
   ```
- Follow the prompts to start the build process.

### Step 3: Download IPA
- After the build is complete, you will receive a link in your terminal to download the IPA file.
- You can also access build details from your Expo account dashboard in the "Builds" section.

### Conclusion
This guide provides a straightforward method to build APK and IPA files for your applications using Expo EAS. Ensure to check the official Expo documentation for any updates or additional configurations needed for your specific project.
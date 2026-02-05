#!/bin/bash
# Script to generate Android keystore and set up GitHub secrets
# Run this script locally after generating the keystore

set -e

REPO=${1:-"S-IDE-studio/S-IDE"}
KEYSTORE_FILE="android-keystore.keystore"
KEY_ALIAS="android-key"
KEY_PASSWORD="android123"
KEYSTORE_PASSWORD="android123"

echo "Setting up Android keystore for $REPO"
echo ""

# Check if keystore exists
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "Generating new keystore..."
    keytool -genkeypair \
        -v \
        -storetype PKCS12 \
        -keystore "$KEYSTORE_FILE" \
        -alias "$KEY_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass "$KEYSTORE_PASSWORD" \
        -keypass "$KEY_PASSWORD" \
        -dname "CN=Android Release,O=S-IDE,C=JP"
    echo "✓ Keystore generated"
else
    echo "✓ Using existing keystore"
fi

echo ""
echo "Setting GitHub secrets..."

# Base64 encode the keystore
KEYSTORE_BASE64=$(base64 -i "$KEYSTORE_FILE")

# Set secrets
echo "$KEYSTORE_BASE64" | gh secret set ANDROID_KEYSTORE_BASE64 -R "$REPO"
echo "✓ Set ANDROID_KEYSTORE_BASE64"

echo "$KEY_ALIAS" | gh secret set ANDROID_KEY_ALIAS -R "$REPO"
echo "✓ Set ANDROID_KEY_ALIAS"

echo "$KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD -R "$REPO"
echo "✓ Set ANDROID_KEY_PASSWORD"

echo "$KEYSTORE_PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD -R "$REPO"
echo "✓ Set ANDROID_KEYSTORE_PASSWORD"

echo ""
echo "✓ All secrets set successfully!"
echo ""
echo "You can now run the mobile release workflow."

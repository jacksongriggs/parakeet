#!/bin/bash

echo "🔍 Finding your Mac's IP address for Parakeet iOS app..."
echo ""

# Get all network interfaces with IP addresses
IPS=$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}')

if [ -z "$IPS" ]; then
    echo "❌ No network interfaces found"
    echo "Make sure you're connected to WiFi"
    exit 1
fi

echo "📱 Available IP addresses:"
echo ""

for IP in $IPS; do
    echo "  $IP"
done

echo ""
echo "📝 Update your iOS app with one of these addresses:"
echo ""

# Get the most likely WiFi IP (usually starts with 192.168 or 10.)
WIFI_IP=$(echo "$IPS" | grep -E '^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[01]))\.' | head -1)

if [ -n "$WIFI_IP" ]; then
    echo "🎯 Most likely WiFi IP: $WIFI_IP"
    echo ""
    echo "In ParakeetClient.swift, change:"
    echo "  @Published var serverURL = \"http://$WIFI_IP:3001\""
    echo ""
    echo "Test the connection:"
    echo "  curl http://$WIFI_IP:3001/health"
else
    echo "Use the IP that matches your WiFi network"
    echo "Usually starts with 192.168.x.x or 10.x.x.x"
fi

echo ""
echo "🧪 Testing Parakeet server connection..."

for IP in $IPS; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://$IP:3001/health" 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Parakeet server found at: http://$IP:3001"
        echo ""
        echo "🎉 Use this URL in your iOS app!"
        exit 0
    fi
done

echo "❌ Parakeet server not found on port 3001"
echo "Make sure your Parakeet server is running:"
echo "  cd /Users/jackson/Projects/Parakeet"
echo "  deno task dev"

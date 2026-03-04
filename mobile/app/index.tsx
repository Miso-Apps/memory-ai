import React from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the Home tab
  return <Redirect href="/(tabs)/home" />;
}

// Placeholder screen – the tab button is overridden in _layout.tsx to push /capture instead.
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function CreateTab() {
  useEffect(() => {
    router.replace('/capture');
  }, []);
  return null;
}

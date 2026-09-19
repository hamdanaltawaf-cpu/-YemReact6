'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
/** Load interaction-heavy code on first use, then keep dialogs mounted for focus restoration. */
const Preview = dynamic(() => import('./Preview').then((m) => m.Preview));
const Settings = dynamic(() => import('./Settings').then((m) => m.Settings));
export function AppOverlays() {
  const app = useApp();
  const [previewLoaded, setPreviewLoaded] = useState(false),
    [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    if (app.preview) setPreviewLoaded(true);
    if (app.settings) setSettingsLoaded(true);
  }, [app.preview, app.settings]);
  return (
    <>
      {(app.preview || previewLoaded) && <Preview />}
      {(app.settings || settingsLoaded) && <Settings />}
    </>
  );
}

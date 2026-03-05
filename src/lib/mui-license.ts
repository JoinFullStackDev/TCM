'use client';

import { LicenseInfo } from '@mui/x-license';

const key = process.env.NEXT_PUBLIC_MUI_X_LICENSE_KEY;
if (key) {
  LicenseInfo.setLicenseKey(key);
}

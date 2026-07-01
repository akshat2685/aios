import { Configuration } from 'electron-builder';
import path from 'path';

const builderConfig: Configuration = {
  appId: 'com.aios.personalos',
  productName: 'AIOS',
  directories: {
    output: 'dist/installer',
    buildResources: 'assets'
  },
  files: [
    'dist/**/*',
    'package.json'
  ],
  win: {
    target: ['nsis'],
    icon: 'assets/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  electronSquirrelRelaunch: {
    harvesterAppDataMsgs: []
  }
};

export default builderConfig;

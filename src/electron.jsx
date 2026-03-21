const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1280, height: 800 })
  win.loadURL('http://localhost:3001/api') // or load built dist/index.html
})

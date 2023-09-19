import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { getData } from './data/getData';
export const imurl = import.meta.url

// console.warn("禁用log")
// console.log = function(){}
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

getData().then(() => {
  root.render(
    // <React.StrictMode>
    <App />
    // </React.StrictMode>
  );
});
// PackageInfo.createPackageInfo('pk1','/package/home_SAMPLE.zip',{'_H_BG_0':'bg_0.png','_H_BG_1':'bg_1.png','_H_LOGO':'霂LOGO.png','_H_TITLE':'_h_title.png'}).load({})



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from './logo.svg';
import Page from './page'
import './App.less';
import { FixedArray } from './type';
import { useDTJ } from './worker/hooks';

function App() {
  const [flag, setFlag] = useState(true)
  // const [phase, [[a1], [b1, b2], [c1]]] = useDTJ(['a', 1], ['b', 2], ['c', 1], ['d', 0])
  return (
    <div className="App" onClick={() => setFlag(!flag)}>
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header> */}
      {/* {phase}
      {[a1, b1, b2, c1].map((e,i) => <button key={i} onClick={(()=>e(true))} disabled={e()}>{e().toString()}</button>)} */}
      {<Page.HomeP />}
      {<Page.LoadingP loadList={['_P_INDOOR_5', '_P_INDOOR_4', '_P_INDOOR_4copy', '_C_12_01', '_BGM_01', '_H_BG_0', '_H_BG_1', '_BGM_02', 'CG_01', 'CG_02', '_H_LOGO', '_H_TITLE']} />}
    </div>
  );
}
export default App;

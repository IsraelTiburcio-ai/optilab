import React from 'react';
import ReactDOM from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import {ProgressProvider} from './store';
import {AuthProvider} from './auth/AuthProvider';
import {syncEnabled} from './progress/config';
import {academicEnabled} from './academic/config';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true}}render(){return this.state.error?<main><h1>La aventura necesita una pausa</h1><p>No pudimos cargar la aplicación. Recarga la página para intentarlo de nuevo.</p><button onClick={()=>location.reload()}>Volver a intentar</button></main>:this.props.children}}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><HashRouter><AuthProvider coordinateSessions={syncEnabled||academicEnabled}><ProgressProvider><App/></ProgressProvider></AuthProvider></HashRouter></ErrorBoundary></React.StrictMode>);

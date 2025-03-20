import React, { useState, useEffect } from 'react';
import './App.css';
import Chatter from './Chatter';
import yaml from 'js-yaml';
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  // const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  // const [authError, setAuthError] = useState(null);
  const [tokenClient, setTokenClient] = useState(null);
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GCP_CLIENT_ID;;
  
  useEffect(() => {
    fetch('/agents.yaml')
      .then((response) => response.text())
      .then((yamlText) => {
        const parsedYaml = yaml.load(yamlText);
        if (parsedYaml && parsedYaml.agents) {
          setAgents(parsedYaml.agents);
          if (parsedYaml.agents.length > 0) {
            setSelectedAgent(parsedYaml.agents[0]);
          }
        }
      })
      .catch((error) => console.error('Error loading agents.yaml:', error));
  }, []);

  const requestAccessToken = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken(); // ✅ Now triggered by user action
    } else {
      console.error("Token client not initialized yet.");
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "profile email openid https://www.googleapis.com/auth/cloud-platform",
        callback: (tokenResponse) => {
          // console.log("OAuth Access Token:", tokenResponse.access_token);
          setAccessToken(tokenResponse.access_token);
        },
      });
      setTokenClient(client);
    };
    document.body.appendChild(script);
  }, [GOOGLE_CLIENT_ID]);

  const handleTabClick = (agent) => {
    setSelectedAgent(agent);
  };

  const toggleTabs = () => {
    setTabsCollapsed(!tabsCollapsed);
  };

  return (
    <div className="app-container">
      {/* {accessToken ? ( */}
      {!accessToken ? (
        <div className="home-container">
          <h1>Welcome</h1>
          <p>Please log in to continue.</p>
          <div className="signinContainer">
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <div>
                <div>
                  {accessToken ? (
                    <p>Authenticated</p> // Show this message when accessToken is available
                  ) : (
                    <button className="google-login-button" onClick={requestAccessToken}>
                      Sign in with Google
                    </button>
                  )}
                </div>
              </div>
            </GoogleOAuthProvider>
            {/* {authError && <p style={{ color: 'red' }}>Error: {authError}</p>} */}
          </div>
        </div>
      ) : (
        <>
          <div className={`tabs ${tabsCollapsed ? 'collapsed' : ''}`}>
            <div className="nav-title">Chatter</div>
            <button className="collapse-toggle" onClick={toggleTabs}>
              {tabsCollapsed ? "☰" : "☰"}
            </button>
            {agents.map((agent, index) => {
              const agentName = Object.keys(agent)[0];
              return (
                <button
                  key={index}
                  className={`tab-button ${selectedAgent && Object.keys(selectedAgent)[0] === agentName ? "active" : ""}`}
                  onClick={() => handleTabClick(agent)}
                >
                  <span>{agentName}</span>
                </button>
              );
            })}
          </div>
          <div className="content">
            {selectedAgent && <Chatter accessToken={accessToken} agentConfig={selectedAgent[Object.keys(selectedAgent)[0]]} />}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
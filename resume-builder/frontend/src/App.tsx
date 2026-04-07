import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import JobList from './components/JobList';
import ResumeEditor from './components/ResumeEditor';
import ApplicationTracker from './components/ApplicationTracker';
import './styles/App.css';

const App: React.FC = () => {
  return (
    <Router>
      <div className="App">
        <Switch>
          <Route path="/" exact component={LoginForm} />
          <Route path="/jobs" component={JobList} />
          <Route path="/resume" component={ResumeEditor} />
          <Route path="/applications" component={ApplicationTracker} />
        </Switch>
      </div>
    </Router>
  );
};

export default App;
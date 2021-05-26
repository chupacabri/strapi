/**
 *
 * App.js
 *
 */

import React, { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { Switch, Route } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators, compose } from 'redux';
import { LoadingIndicatorPage, auth, request, useNotification } from '@strapi/helper-plugin';
import PrivateRoute from '../../components/PrivateRoute';
import AuthPage from '../AuthPage';
import NotFoundPage from '../NotFoundPage';
import { getUID } from './utils';
import { Content, Wrapper } from './components';
import { getDataSucceeded } from './actions';
import routes from './utils/routes';
import { makeUniqueRoutes, createRoute } from '../SettingsPage/utils';

const AuthenticatedApp = lazy(() => import('../../components/AuthenticatedApp'));
function App(props) {
  const toggleNotification = useNotification();
  const getDataRef = useRef();
  const [{ isLoading, hasAdmin }, setState] = useState({ isLoading: true, hasAdmin: false });
  getDataRef.current = props.getDataSucceeded;

  const authRoutes = useMemo(() => {
    return makeUniqueRoutes(
      routes.map(({ to, Component, exact }) => createRoute(Component, to, exact))
    );
  }, []);

  useEffect(() => {
    const currentToken = auth.getToken();

    const renewToken = async () => {
      try {
        const {
          data: { token },
        } = await request('/admin/renew-token', {
          method: 'POST',
          body: { token: currentToken },
        });
        auth.updateToken(token);
      } catch (err) {
        // Refresh app
        auth.clearAppStorage();
        window.location.reload();
      }
    };

    if (currentToken) {
      renewToken();
    }
  }, []);

  useEffect(() => {
    const getData = async () => {
      try {
        const { data } = await request('/admin/init', { method: 'GET' });

        const { uuid } = data;

        if (uuid) {
          try {
            const deviceId = await getUID();

            fetch('https://analytics.strapi.io/track', {
              method: 'POST',
              body: JSON.stringify({
                event: 'didInitializeAdministration',
                uuid,
                deviceId,
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });
          } catch (e) {
            // Silent.
          }
        }

        getDataRef.current(data);
        setState({ isLoading: false, hasAdmin: data.hasAdmin });
      } catch (err) {
        toggleNotification({
          type: 'warning',
          message: { id: 'app.containers.App.notification.error.init' },
        });
      }
    };

    getData();
  }, [toggleNotification]);

  const setHasAdmin = hasAdmin => setState(prev => ({ ...prev, hasAdmin }));

  if (isLoading) {
    return <LoadingIndicatorPage />;
  }

  return (
    <Suspense fallback={<LoadingIndicatorPage />}>
      <Wrapper>
        <Content>
          <Switch>
            {authRoutes}
            <Route
              path="/auth/:authType"
              render={routerProps => (
                <AuthPage {...routerProps} setHasAdmin={setHasAdmin} hasAdmin={hasAdmin} />
              )}
              exact
            />
            <PrivateRoute path="/" component={AuthenticatedApp} />
            <Route path="" component={NotFoundPage} />
          </Switch>
        </Content>
      </Wrapper>
    </Suspense>
  );
}

App.propTypes = {
  getDataSucceeded: PropTypes.func.isRequired,
};

export function mapDispatchToProps(dispatch) {
  return bindActionCreators({ getDataSucceeded }, dispatch);
}

const withConnect = connect(null, mapDispatchToProps);

export default compose(withConnect)(App);
export { App };

import { Link as RouterLink, NavLink as RouterNavLink } from 'react-router-dom';

export function Link(props) {
  return <RouterLink {...props} viewTransition />;
}

export function NavLink(props) {
  return <RouterNavLink {...props} viewTransition />;
}

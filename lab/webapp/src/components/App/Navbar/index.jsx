/* ~This file is part of the PennAI library~

Copyright (C) 2017 Epistasis Lab, University of Pennsylvania

PennAI is maintained by:
    - Heather Williams (hwilli@upenn.edu)
    - Weixuan Fu (weixuanf@upenn.edu)
    - William La Cava (lacava@upenn.edu)
    - Michael Stauffer (stauffer@upenn.edu)
    - and many other generous open source contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

(Autogenerated header, do not modify)

*/
import React from 'react';
import MediaQuery from 'react-responsive';
import DeviceWatcher from '../../../utils/device-watcher';
import { Menu, Dropdown, Icon } from 'semantic-ui-react';
import { Link } from 'react-router';
/**
* child component of menu bar - if preferences successfully retrieved, create
* menu bar with links to other sections of site
*/
function Navbar({ preferences }) {
  const getUserTrigger = () => {
    return (
      <Menu.Item>
        <Icon name="user" />
        <MediaQuery minWidth={DeviceWatcher.breakpoints.MIN_TABLET}>
          {preferences.username} <Icon name="caret down" />
        </MediaQuery>
      </Menu.Item>
    );
  };

  return (
    <Menu inverted color="grey" fixed="top" size="large" borderless>
      <Link to="datasets" className="link">
        <Menu.Item header name="PennAI" />
      </Link>
      <MediaQuery minWidth={DeviceWatcher.breakpoints.MAX_MOBILE}>
        <Menu.Item name="Your friendly AI assistant" />
      </MediaQuery>
      {preferences &&
        <Menu.Menu position="right">
          <Link to="datasets" className="link" activeClassName="active">
            <Menu.Item name="Datasets">
              <Icon name="file text outline" />
              <MediaQuery minWidth={DeviceWatcher.breakpoints.MIN_TABLET}>
                {'Datasets'}
              </MediaQuery>
            </Menu.Item>
          </Link>
          <Link to="experiments" className="link" activeClassName="active">
            <Menu.Item name="Experiments">
              <Icon name="lab" />
              <MediaQuery minWidth={DeviceWatcher.breakpoints.MIN_TABLET}>
                {'Experiments'}
              </MediaQuery>
            </Menu.Item>
          </Link>
          <Link to="admin" className="link" activeClassName="active">
            <Menu.Item name="Admin">
              <Icon name="wrench" />
              <MediaQuery minWidth={DeviceWatcher.breakpoints.MIN_TABLET}>
                {'Admin'}
              </MediaQuery>
            </Menu.Item>
          </Link>
          <Menu.Item>
            <Icon name="user" />
            <MediaQuery minWidth={DeviceWatcher.breakpoints.MIN_TABLET}>
              {preferences.username}
            </MediaQuery>
          </Menu.Item>
        </Menu.Menu>
      }
    </Menu>
  );
}

export default Navbar;

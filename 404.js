'use strict';

const locationSnapshot = window.location;
locationSnapshot.replace(
  locationSnapshot.protocol + '//' + locationSnapshot.hostname +
  (locationSnapshot.port ? ':' + locationSnapshot.port : '') +
  locationSnapshot.pathname.split('/').slice(0, 2).join('/') +
  '/?p=' + locationSnapshot.pathname.slice(1).split('/').slice(1).join('/').replace(/&/g, '~and~') +
  (locationSnapshot.search ? '&q=' + locationSnapshot.search.slice(1).replace(/&/g, '~and~') : '') +
  locationSnapshot.hash,
);

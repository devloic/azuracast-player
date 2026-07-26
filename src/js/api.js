/**
 * AzuraCast API handler
 */

import axios from 'axios';
import config from './config';

export default {
  
  getAzuracastHostname(){
    // window.location.origin, not "http://" + hostname: hostname omits the port, so
    // an install served on anything other than :80 produced unreachable API URLs
    // (e.g. http://10.0.0.4/api/stations instead of http://10.0.0.4:8200/...).
    // origin also preserves https.
    return config.apiBaseUrl !== '' ? config.apiBaseUrl : window.location.origin;
  },

  // get station data from api
  getChannels(callback) {
    const apiurl = this.getAzuracastHostname() + '/api/stations';
    const error = 'There was a problem fetching the latest list of music channels from AzuraCast.';

    axios.get(apiurl).then(res => {
      const list = this._parseChannels(res.data);
      if (!list.length) return callback(error, []);
      return callback(null, list);
    })
      .catch(e => {
        return callback(error + String(e.message || ''), []);
      });
  },

  // fetch songs for a channel
  getSongs(channel, callback) {
    const apiurl = channel.songsurl || '';
    const title = channel.name || '...';
    const error = 'There was a problem loading the list of songs for channel ' + title + ' from AzuraCast.';

    axios.get(apiurl).then(res => {
      if (!res.data) return callback(error, []);
      return callback(null, res.data);
    })
      .catch(e => {
        return callback(error + String(e.message || ''), []);
      });
  },

  // fetch next song for a channel
  getNextSongs(channel, callback) {
    const apiurl = channel.songsurl || '';
    const title = channel.name || '...';
    const error = 'Station ' + title + ' does not support Next Songs from AzuraCast.';

    axios.get(apiurl).then(res => {
      if (!res.data.playing_next) return callback(error, []);
      return callback(null, res.data);
    })
      .catch(e => {
        return callback(error + String(e.message || ''), []);
      });
  },

  // parse station list from api response
  _parseChannels(station) {
    let output = [];
    var randomNumber = Math.floor(Math.random() * 5);
    let fileName = ".png";
    let extension = fileName.split("/").pop();
    if (Array.isArray(station)) {
      for (let c of station) {
        c.plsfile = c.playlist_pls_url;
        c.mp3file = c.listen_url;
        c.songsurl = this.getAzuracastHostname() + '/api/nowplaying/' + c.id;
        c.infourl = c.url;
        c.twitter = c.twitter ? 'https://twitter.com/@' + c.twitter : '';
        c.route = '/station/' + c.shortcode;
        // A station with no mount yet (just created, or frontend still starting)
        // used to throw here. The throw landed in getChannels()'s .catch, so the
        // whole station list failed with a generic network-sounding error.
        c.listeners = c.mounts?.[0]?.listeners?.current ?? 0;
        c.updated = c.updated | 0;
        c.favorite = false;
        c.active = false;
        c.imgLogo = this.getAzuracastHostname() + '/static/uploads/' + c.shortcode + '/' + 'album_art.'  + randomNumber + extension;
        output.push(c);
      }
    }
    return output;
  },
}

import EventEmitter from 'events'
import emitStream from 'emit-stream'
import * as logLib from '../logger'
const logger = logLib.child({category: 'dat', subcategory: 'watchlist'})

// dat modules
import * as datArchives from './archives'

import datDns from './dns'
import * as watchlistDb from '../dbs/watchlist'

// globals
// =

var watchlistEvents = new EventEmitter()

// exported methods
// =

export async function setup () {
  try {
    var watchedSites = await watchlistDb.getSites(0)
    for (let site of watchedSites) {
      watch(site)
    }
  } catch (err) {
    logger.error('Error while loading watchlist', {err})
    throw new Error('Failed to load the watchlist')
  }
}

export async function addSite (profileId, url, opts) {
    // validate parameters
  if (!url || typeof url !== 'string') {
    throw new Error('url must be a string')
  }
  if (!opts.description || typeof opts.description !== 'string') {
    throw new Error('description must be a string')
  }
  if (typeof opts.seedWhenResolved !== 'boolean') {
    throw new Error('seedWhenResolved must be a boolean')
  }
  if (!url.startsWith('drive://')) {
    url = 'drive://' + url
  }

  try {
    var site = await watchlistDb.addSite(profileId, url, opts)
    watch(site)
  } catch (err) {
    throw new Error('Failed to add to watchlist')
  }
}

export async function getSites (profileId) {
  return watchlistDb.getSites(profileId)
}

export async function updateWatchlist (profileId, site, opts) {
  try {
    await watchlistDb.updateWatchlist(profileId, site, opts)
  } catch (err) {
    throw new Error('Failed to update the watchlist')
  }
}

export async function removeSite (profileId, url) {
  // validate parameters
  if (!url || typeof url !== 'string') {
    throw new Error('url must be a string')
  }
  return watchlistDb.removeSite(profileId, url)
}

// events

export function createEventsStream () {
  return emitStream(watchlistEvents)
}

// internal methods
// =

async function watch (site) {
  // resolve DNS
  var key
  try {
    key = await datDns.resolveName(site.url)
  } catch (e) {}
  if (!key) {
    // try again in 30s
    setTimeout(watch, 30e3)
    return
  }

  // load archive
  var archive = await datArchives.loadArchive(key)
  if (site.resolved === 0) {
    watchlistEvents.emit('resolved', site)
  }
  archive.pda.download('/').catch(e => { /* ignore cancels */ }) // download the site to make sure it's available
  await updateWatchlist(0, site, {resolved: 1})
}
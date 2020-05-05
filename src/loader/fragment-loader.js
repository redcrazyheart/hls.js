/*
 * Fragment Loader
*/

import Event from '../events';
import EventHandler from '../event-handler';
import { ErrorTypes, ErrorDetails } from '../errors';
import { logger } from '../utils/logger';

class FragmentLoader extends EventHandler {
  constructor (hls) {
    super(hls, Event.FRAG_LOADING);
    this.loaders = {};
  }

  destroy () {
    let loaders = this.loaders;
    for (let loaderName in loaders) {
      let loader = loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};

    super.destroy();
  }

  onFragLoading (data) {
    const frag = data.frag;
      const type = frag.type;
      const loaders = this.loaders;
      const config = this.hls.config;
      const FragmentILoader = config.fLoader;
      const DefaultILoader = config.loader;

    // reset fragment state
    frag.loaded = 0;

    let loader = loaders[type];
    if (loader) {
      logger.warn(`abort previous fragment loader for type: ${type}`);
      loader.abort();
    }

    loader = loaders[type] = frag.loader =
      config.fLoader ? new FragmentILoader(config) : new DefaultILoader(config);

    let loaderContext; let loaderConfig; let loaderCallbacks;

    loaderContext = { url: frag.url, frag: frag, responseType: 'arraybuffer', progressData: false };

    let start = frag.byteRangeStartOffset;
      let end = frag.byteRangeEndOffset;

    if (Number.isFinite(start) && Number.isFinite(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }

    loaderConfig = {
      timeout: config.fragLoadingTimeOut,
      maxRetry: 0,
      retryDelay: 0,
      maxRetryDelay: config.fragLoadingMaxRetryTimeout
    };

    loaderCallbacks = {
      onSuccess: this.loadsuccess.bind(this),
      onError: this.loaderror.bind(this),
      onTimeout: this.loadtimeout.bind(this),
      onProgress: this.loadprogress.bind(this)
    };

    loader.load(loaderContext, loaderConfig, loaderCallbacks);
  }

  loadsuccess (response, stats, context, networkDetails = null) {
    let payload = response.data; let frag = context.frag;
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_LOADED, { payload: payload, frag: frag, stats: stats, networkDetails: networkDetails });
  }

  loaderror (response, context, networkDetails = null) {
    const frag = context.frag;
    let loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_SKIPPED, { frag: context.frag });
  }

  loadtimeout (stats, context, networkDetails = null) {
    const frag = context.frag;
    let loader = frag.loader;
    if (loader) {
      loader.abort();
    }

    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.hls.trigger(Event.FRAG_SKIPPED, { frag: context.frag });
  }

  // data will be used for progressive parsing
  loadprogress (stats, context, data, networkDetails = null) { // jshint ignore:line
    let frag = context.frag;
    frag.loaded = stats.loaded;
    this.hls.trigger(Event.FRAG_LOAD_PROGRESS, { frag: frag, stats: stats, networkDetails: networkDetails });
  }
}

export default FragmentLoader;

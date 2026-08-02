(function () {
    const inFlightRequests = new Map();
    const scriptLoads = new Map();

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function shouldRetryStatus(status) {
        return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
    }

    function shouldRetryError(error) {
        if (!error) return false;
        if (error.name === 'TimeoutError') return true;
        return error instanceof TypeError;
    }

    function toRequestKey(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        return `${method}:${url}`;
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
        const controller = new AbortController();
        const signal = controller.signal;
        let timeoutId = null;
        let abortListener = null;
        let timedOut = false;

        if (options.signal) {
            if (options.signal.aborted) controller.abort();
            abortListener = () => controller.abort();
            options.signal.addEventListener('abort', abortListener, { once: true });
        }

        timeoutId = setTimeout(() => {
            if (!signal.aborted) {
                timedOut = true;
                controller.abort();
            }
        }, timeoutMs);

        try {
            return await fetch(url, { ...options, signal });
        } catch (error) {
            if (timedOut) {
                const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
                timeoutError.name = 'TimeoutError';
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            if (abortListener && options.signal) {
                options.signal.removeEventListener('abort', abortListener);
            }
        }
    }

    async function fetchWithRetry(url, options = {}, policy = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const retries = Number.isFinite(policy.retries) ? policy.retries : 2;
        const timeoutMs = Number.isFinite(policy.timeoutMs) ? policy.timeoutMs : 12000;
        const retryDelayMs = Number.isFinite(policy.retryDelayMs) ? policy.retryDelayMs : 300;
        const backoffFactor = Number.isFinite(policy.backoffFactor) ? policy.backoffFactor : 2;
        const jitterRatio = Number.isFinite(policy.jitterRatio) ? policy.jitterRatio : 0.2;
        const dedupe = policy.dedupe !== undefined ? policy.dedupe : method === 'GET';
        const dedupeKey = policy.dedupeKey || toRequestKey(url, options);

        const run = async () => {
            let attempt = 0;
            let delay = retryDelayMs;

            while (true) {
                let response;

                try {
                    response = await fetchWithTimeout(url, options, timeoutMs);
                } catch (error) {
                    if (attempt >= retries || !shouldRetryError(error)) throw error;
                    const jitter = delay * jitterRatio * Math.random();
                    await sleep(delay + jitter);
                    attempt += 1;
                    delay *= backoffFactor;
                    continue;
                }

                if (!shouldRetryStatus(response.status) || attempt >= retries) {
                    return response;
                }

                const jitter = delay * jitterRatio * Math.random();
                await sleep(delay + jitter);
                attempt += 1;
                delay *= backoffFactor;
            }
        };

        if (!dedupe) return run();

        if (inFlightRequests.has(dedupeKey)) {
            return inFlightRequests.get(dedupeKey);
        }

        const pending = run().finally(() => {
            inFlightRequests.delete(dedupeKey);
        });

        inFlightRequests.set(dedupeKey, pending);
        return pending;
    }

    async function fetchJson(url, options = {}, policy = {}) {
        const response = await fetchWithRetry(url, options, policy);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    async function fetchText(url, options = {}, policy = {}) {
        const response = await fetchWithRetry(url, options, policy);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    }

    async function loadScriptOnce(src, options = {}) {
        if (!src) throw new Error('Script source is required');
        if (scriptLoads.has(src)) return scriptLoads.get(src);

        const absoluteSrc = new URL(src, window.location.href).href;
        const existing = Array.from(document.scripts).find(s => s.src === absoluteSrc);
        if (existing) {
            const resolved = Promise.resolve();
            scriptLoads.set(src, resolved);
            return resolved;
        }

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = options.async !== undefined ? options.async : true;
            if (options.crossOrigin) script.crossOrigin = options.crossOrigin;

            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });

        scriptLoads.set(src, promise);
        return promise;
    }

    window.netUtils = {
        fetchWithRetry,
        fetchJson,
        fetchText,
        loadScriptOnce
    };
})();

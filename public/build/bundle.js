
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value = ret) {
        store.set(value);
        return ret;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.26.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const shoppingCategory = writable("mcmuffins");
    const shoppingCart = writable({
      doubleSausageMcmuffin: { count: 0, price: 2.89, isLarge: 0 },
      doubleSausageMcmuffinMeal: { count: 0, price: 4.39, isLarge: 0 },
      baconBrownSauce: { count: 0, price: 2.89, isLarge: 0 },
      baconBrownSauceMeal: { count: 0, price: 4.29, isLarge: 0 },
      pancakeSausageSyrup: { count: 0, price: 2.89, isLarge: 0 },
      pancakeSausageMeal: { count: 0, price: 3.69, isLarge: 0 },
    });

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/App.svelte generated by Svelte v3.26.0 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (166:47) 
    function create_if_block_8(ctx) {
    	let div2;
    	let h2;
    	let t1;
    	let div0;
    	let h30;
    	let t3;
    	let p0;
    	let t5;
    	let p1;
    	let t6;
    	let t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * 100) / 100 + "";
    	let t7;
    	let t8;
    	let button0;
    	let t10;
    	let div1;
    	let h31;
    	let t12;
    	let p2;
    	let t14;
    	let p3;
    	let t15;
    	let t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * 100) / 100 + "";
    	let t16;
    	let t17;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Porridge Section";
    			t1 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Pancakes & Sausage with Syrup";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t5 = space();
    			p1 = element("p");
    			t6 = text("£");
    			t7 = text(t7_value);
    			t8 = space();
    			button0 = element("button");
    			button0.textContent = "ADD\n            TO CART";
    			t10 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Pancakes & Sausage Meal";
    			t12 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t14 = space();
    			p3 = element("p");
    			t15 = text("£");
    			t16 = text(t16_value);
    			t17 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			attr_dev(h2, "class", "svelte-17asmgu");
    			add_location(h2, file, 167, 8, 4313);
    			attr_dev(h30, "class", "svelte-17asmgu");
    			add_location(h30, file, 169, 10, 4363);
    			add_location(p0, file, 170, 10, 4412);
    			add_location(p1, file, 174, 10, 4566);
    			attr_dev(button0, "id", "pancakeSausageSyrup");
    			add_location(button0, file, 178, 10, 4715);
    			add_location(div0, file, 168, 8, 4347);
    			attr_dev(h31, "class", "svelte-17asmgu");
    			add_location(h31, file, 185, 10, 4937);
    			add_location(p2, file, 186, 10, 4980);
    			add_location(p3, file, 190, 10, 5134);
    			attr_dev(button1, "id", "pancakeSausageMeal");
    			add_location(button1, file, 194, 10, 5282);
    			attr_dev(div1, "class", "pancakeSausageMeal");
    			add_location(div1, file, 184, 8, 4894);
    			add_location(div2, file, 166, 6, 4299);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, p0);
    			append_dev(div0, t5);
    			append_dev(div0, p1);
    			append_dev(p1, t6);
    			append_dev(p1, t7);
    			append_dev(div0, t8);
    			append_dev(div0, button0);
    			append_dev(div2, t10);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t12);
    			append_dev(div1, p2);
    			append_dev(div1, t14);
    			append_dev(div1, p3);
    			append_dev(p3, t15);
    			append_dev(p3, t16);
    			append_dev(div1, t17);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_4*/ ctx[7], false, false, false),
    					listen_dev(button1, "click", /*click_handler_5*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t7_value !== (t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * 100) / 100 + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*$shoppingCart*/ 1 && t16_value !== (t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * 100) / 100 + "")) set_data_dev(t16, t16_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(166:47) ",
    		ctx
    	});

    	return block;
    }

    // (131:44) 
    function create_if_block_7(ctx) {
    	let div2;
    	let h2;
    	let t1;
    	let div0;
    	let h30;
    	let t3;
    	let p0;
    	let t5;
    	let p1;
    	let t6;
    	let t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * 100) / 100 + "";
    	let t7;
    	let t8;
    	let button0;
    	let t10;
    	let div1;
    	let h31;
    	let t12;
    	let p2;
    	let t14;
    	let p3;
    	let t15;
    	let t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * 100) / 100 + "";
    	let t16;
    	let t17;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Wraps Section";
    			t1 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Bacon Roll with Brown Sauce";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t5 = space();
    			p1 = element("p");
    			t6 = text("£");
    			t7 = text(t7_value);
    			t8 = space();
    			button0 = element("button");
    			button0.textContent = "ADD TO\n            CART";
    			t10 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Bacon Roll with Brown Sauce Meal";
    			t12 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t14 = space();
    			p3 = element("p");
    			t15 = text("£");
    			t16 = text(t16_value);
    			t17 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			attr_dev(h2, "class", "svelte-17asmgu");
    			add_location(h2, file, 132, 8, 3099);
    			attr_dev(h30, "class", "svelte-17asmgu");
    			add_location(h30, file, 134, 10, 3146);
    			add_location(p0, file, 135, 10, 3193);
    			add_location(p1, file, 139, 10, 3347);
    			attr_dev(button0, "id", "baconBrownSauce");
    			add_location(button0, file, 143, 10, 3492);
    			add_location(div0, file, 133, 8, 3130);
    			attr_dev(h31, "class", "svelte-17asmgu");
    			add_location(h31, file, 150, 10, 3707);
    			add_location(p2, file, 151, 10, 3759);
    			add_location(p3, file, 155, 10, 3913);
    			attr_dev(button1, "id", "baconBrownSauceMeal");
    			add_location(button1, file, 159, 10, 4062);
    			attr_dev(div1, "class", "baconBrownSauceMeal");
    			add_location(div1, file, 149, 8, 3663);
    			add_location(div2, file, 131, 6, 3085);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, p0);
    			append_dev(div0, t5);
    			append_dev(div0, p1);
    			append_dev(p1, t6);
    			append_dev(p1, t7);
    			append_dev(div0, t8);
    			append_dev(div0, button0);
    			append_dev(div2, t10);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t12);
    			append_dev(div1, p2);
    			append_dev(div1, t14);
    			append_dev(div1, p3);
    			append_dev(p3, t15);
    			append_dev(p3, t16);
    			append_dev(div1, t17);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_2*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*click_handler_3*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t7_value !== (t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * 100) / 100 + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*$shoppingCart*/ 1 && t16_value !== (t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * 100) / 100 + "")) set_data_dev(t16, t16_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(131:44) ",
    		ctx
    	});

    	return block;
    }

    // (96:4) {#if $shoppingCategory === 'mcmuffins'}
    function create_if_block_6(ctx) {
    	let div2;
    	let h2;
    	let t1;
    	let div0;
    	let h30;
    	let t3;
    	let p0;
    	let t5;
    	let p1;
    	let t6;
    	let t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * 100) / 100 + "";
    	let t7;
    	let t8;
    	let button0;
    	let t10;
    	let div1;
    	let h31;
    	let t12;
    	let p2;
    	let t14;
    	let p3;
    	let t15;
    	let t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * 100) / 100 + "";
    	let t16;
    	let t17;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "McMuffins Section";
    			t1 = space();
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Double Sausage and Egg McMuffin®";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t5 = space();
    			p1 = element("p");
    			t6 = text("£");
    			t7 = text(t7_value);
    			t8 = space();
    			button0 = element("button");
    			button0.textContent = "ADD\n            TO CART";
    			t10 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Double Sausage Egg McMuffin® Meal";
    			t12 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t14 = space();
    			p3 = element("p");
    			t15 = text("£");
    			t16 = text(t16_value);
    			t17 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			attr_dev(h2, "class", "svelte-17asmgu");
    			add_location(h2, file, 97, 8, 1836);
    			attr_dev(h30, "class", "svelte-17asmgu");
    			add_location(h30, file, 99, 10, 1887);
    			add_location(p0, file, 100, 10, 1939);
    			add_location(p1, file, 104, 10, 2093);
    			attr_dev(button0, "id", "doubleSausageMcmuffin");
    			add_location(button0, file, 108, 10, 2244);
    			add_location(div0, file, 98, 8, 1871);
    			attr_dev(h31, "class", "svelte-17asmgu");
    			add_location(h31, file, 115, 10, 2477);
    			add_location(p2, file, 116, 10, 2530);
    			add_location(p3, file, 120, 10, 2684);
    			attr_dev(button1, "id", "doubleSausageMcmuffinMeal");
    			add_location(button1, file, 124, 10, 2839);
    			attr_dev(div1, "class", "doubleSausageMcmuffinMeal");
    			add_location(div1, file, 114, 8, 2427);
    			attr_dev(div2, "class", "doubleSausageMcmuffin");
    			add_location(div2, file, 96, 6, 1792);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, p0);
    			append_dev(div0, t5);
    			append_dev(div0, p1);
    			append_dev(p1, t6);
    			append_dev(p1, t7);
    			append_dev(div0, t8);
    			append_dev(div0, button0);
    			append_dev(div2, t10);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t12);
    			append_dev(div1, p2);
    			append_dev(div1, t14);
    			append_dev(div1, p3);
    			append_dev(p3, t15);
    			append_dev(p3, t16);
    			append_dev(div1, t17);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t7_value !== (t7_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * 100) / 100 + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*$shoppingCart*/ 1 && t16_value !== (t16_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * 100) / 100 + "")) set_data_dev(t16, t16_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(96:4) {#if $shoppingCategory === 'mcmuffins'}",
    		ctx
    	});

    	return block;
    }

    // (207:6) {#if $shoppingCart.doubleSausageMcmuffin.count}
    function create_if_block_5(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count * 100) / 100 + /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.isLarge * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Double Sausage and Egg McMuffin®";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 208, 10, 5718);
    			attr_dev(button0, "id", "decrement");
    			attr_dev(button0, "class", "svelte-17asmgu");
    			add_location(button0, file, 212, 10, 6077);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 215, 10, 6212);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 218, 10, 6347);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 207, 8, 5645);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_6*/ ctx[9], false, false, false),
    					listen_dev(button1, "click", /*click_handler_7*/ ctx[10], false, false, false),
    					listen_dev(button2, "click", /*click_handler_8*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count * 100) / 100 + /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.isLarge * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(207:6) {#if $shoppingCart.doubleSausageMcmuffin.count}",
    		ctx
    	});

    	return block;
    }

    // (224:6) {#if $shoppingCart.doubleSausageMcmuffinMeal.count}
    function create_if_block_4(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.isLarge * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Double Sausage and Egg McMuffin®";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 225, 10, 6713);
    			attr_dev(button0, "class", "decrement-button svelte-17asmgu");
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 230, 10, 7117);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 234, 10, 7293);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 237, 10, 7432);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 224, 8, 6640);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_9*/ ctx[12], false, false, false),
    					listen_dev(button1, "click", /*click_handler_10*/ ctx[13], false, false, false),
    					listen_dev(button2, "click", /*click_handler_11*/ ctx[14], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.isLarge * /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(224:6) {#if $shoppingCart.doubleSausageMcmuffinMeal.count}",
    		ctx
    	});

    	return block;
    }

    // (243:6) {#if $shoppingCart.baconBrownSauce.count}
    function create_if_block_3(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].baconBrownSauce.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * /*$shoppingCart*/ ctx[0].baconBrownSauce.count * 100) / 100 + /*$shoppingCart*/ ctx[0].baconBrownSauce.isLarge * /*$shoppingCart*/ ctx[0].baconBrownSauce.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Bacon Roll with Brown Sauce";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 244, 10, 7796);
    			attr_dev(button0, "id", "decrement");
    			attr_dev(button0, "class", "svelte-17asmgu");
    			add_location(button0, file, 248, 10, 8120);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 251, 10, 8249);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 254, 10, 8378);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 243, 8, 7723);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_12*/ ctx[15], false, false, false),
    					listen_dev(button1, "click", /*click_handler_13*/ ctx[16], false, false, false),
    					listen_dev(button2, "click", /*click_handler_14*/ ctx[17], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].baconBrownSauce.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * /*$shoppingCart*/ ctx[0].baconBrownSauce.count * 100) / 100 + /*$shoppingCart*/ ctx[0].baconBrownSauce.isLarge * /*$shoppingCart*/ ctx[0].baconBrownSauce.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(243:6) {#if $shoppingCart.baconBrownSauce.count}",
    		ctx
    	});

    	return block;
    }

    // (260:6) {#if $shoppingCart.baconBrownSauceMeal.count}
    function create_if_block_2(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.isLarge * /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Bacon Roll with Brown Sauce Meal";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 261, 10, 8726);
    			attr_dev(button0, "id", "decrement");
    			attr_dev(button0, "class", "svelte-17asmgu");
    			add_location(button0, file, 266, 10, 9100);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 269, 10, 9233);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 272, 10, 9366);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 260, 8, 8653);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_15*/ ctx[18], false, false, false),
    					listen_dev(button1, "click", /*click_handler_16*/ ctx[19], false, false, false),
    					listen_dev(button2, "click", /*click_handler_17*/ ctx[20], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.isLarge * /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(260:6) {#if $shoppingCart.baconBrownSauceMeal.count}",
    		ctx
    	});

    	return block;
    }

    // (278:6) {#if $shoppingCart.pancakeSausageSyrup.count}
    function create_if_block_1(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count * 100) / 100 + /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.isLarge * /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Pancakes & Sausage with Syrup";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 279, 10, 9722);
    			attr_dev(button0, "id", "decrement");
    			attr_dev(button0, "class", "svelte-17asmgu");
    			add_location(button0, file, 283, 10, 10068);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 286, 10, 10201);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 289, 10, 10334);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 278, 8, 9649);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_18*/ ctx[21], false, false, false),
    					listen_dev(button1, "click", /*click_handler_19*/ ctx[22], false, false, false),
    					listen_dev(button2, "click", /*click_handler_20*/ ctx[23], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count * 100) / 100 + /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.isLarge * /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(278:6) {#if $shoppingCart.pancakeSausageSyrup.count}",
    		ctx
    	});

    	return block;
    }

    // (295:6) {#if $shoppingCart.pancakeSausageMeal.count}
    function create_if_block(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let t2_value = /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count + "";
    	let t2;
    	let t3;
    	let t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].pancakeSausageMeal.isLarge * /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let button2;
    	let div_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Pancakes & Sausage Meal";
    			t1 = text("\n          x");
    			t2 = text(t2_value);
    			t3 = text("\n          \n          \n          £");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "-";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "+";
    			t9 = space();
    			button2 = element("button");
    			button2.textContent = "SuperSize!";
    			attr_dev(h3, "class", "svelte-17asmgu");
    			add_location(h3, file, 296, 10, 10689);
    			attr_dev(button0, "id", "decrement");
    			attr_dev(button0, "class", "svelte-17asmgu");
    			add_location(button0, file, 301, 10, 11049);
    			attr_dev(button1, "id", "increment");
    			attr_dev(button1, "class", "svelte-17asmgu");
    			add_location(button1, file, 304, 10, 11181);
    			attr_dev(button2, "id", "isLarge");
    			attr_dev(button2, "class", "svelte-17asmgu");
    			add_location(button2, file, 307, 10, 11313);
    			attr_dev(div, "class", "checkout-item");
    			add_location(div, file, 295, 8, 10616);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, t4);
    			append_dev(div, t5);
    			append_dev(div, button0);
    			append_dev(div, t7);
    			append_dev(div, button1);
    			append_dev(div, t9);
    			append_dev(div, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler_21*/ ctx[24], false, false, false),
    					listen_dev(button1, "click", /*click_handler_22*/ ctx[25], false, false, false),
    					listen_dev(button2, "click", /*click_handler_23*/ ctx[26], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$shoppingCart*/ 1 && t2_value !== (t2_value = /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*$shoppingCart*/ 1 && t4_value !== (t4_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count * 100) / 100 + /*$shoppingCart*/ ctx[0].pancakeSausageMeal.isLarge * /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 500 });
    					div_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(295:6) {#if $shoppingCart.pancakeSausageMeal.count}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div4;
    	let div0;
    	let h20;
    	let t1;
    	let ul;
    	let li0;
    	let t3;
    	let li1;
    	let t5;
    	let li2;
    	let t7;
    	let div1;
    	let t8;
    	let div3;
    	let div2;
    	let h21;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*$shoppingCategory*/ ctx[1] === "mcmuffins") return create_if_block_6;
    		if (/*$shoppingCategory*/ ctx[1] === "wraps") return create_if_block_7;
    		if (/*$shoppingCategory*/ ctx[1] === "porridge") return create_if_block_8;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);
    	let if_block1 = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count && create_if_block_5(ctx);
    	let if_block2 = /*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count && create_if_block_4(ctx);
    	let if_block3 = /*$shoppingCart*/ ctx[0].baconBrownSauce.count && create_if_block_3(ctx);
    	let if_block4 = /*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count && create_if_block_2(ctx);
    	let if_block5 = /*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count && create_if_block_1(ctx);
    	let if_block6 = /*$shoppingCart*/ ctx[0].pancakeSausageMeal.count && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			h20 = element("h2");
    			h20.textContent = "Categories";
    			t1 = space();
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "McMuffins";
    			t3 = space();
    			li1 = element("li");
    			li1.textContent = "Wraps & Rolls";
    			t5 = space();
    			li2 = element("li");
    			li2.textContent = "Porridge & Pancakes";
    			t7 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t8 = space();
    			div3 = element("div");
    			div2 = element("div");
    			h21 = element("h2");
    			h21.textContent = "Your order";
    			t10 = space();
    			if (if_block1) if_block1.c();
    			t11 = space();
    			if (if_block2) if_block2.c();
    			t12 = space();
    			if (if_block3) if_block3.c();
    			t13 = space();
    			if (if_block4) if_block4.c();
    			t14 = space();
    			if (if_block5) if_block5.c();
    			t15 = space();
    			if (if_block6) if_block6.c();
    			attr_dev(h20, "class", "svelte-17asmgu");
    			add_location(h20, file, 86, 4, 1438);
    			attr_dev(li0, "id", "mcmuffins");
    			attr_dev(li0, "class", "svelte-17asmgu");
    			add_location(li0, file, 88, 6, 1473);
    			attr_dev(li1, "id", "wraps");
    			attr_dev(li1, "class", "svelte-17asmgu");
    			add_location(li1, file, 89, 6, 1545);
    			attr_dev(li2, "id", "porridge");
    			attr_dev(li2, "class", "svelte-17asmgu");
    			add_location(li2, file, 90, 6, 1617);
    			attr_dev(ul, "class", "svelte-17asmgu");
    			add_location(ul, file, 87, 4, 1462);
    			attr_dev(div0, "id", "categories-section");
    			attr_dev(div0, "class", "svelte-17asmgu");
    			add_location(div0, file, 85, 2, 1404);
    			attr_dev(div1, "id", "shopping-section");
    			attr_dev(div1, "class", "svelte-17asmgu");
    			add_location(div1, file, 94, 2, 1714);
    			attr_dev(h21, "class", "svelte-17asmgu");
    			add_location(h21, file, 205, 6, 5563);
    			attr_dev(div2, "id", "shopping-cart-container");
    			attr_dev(div2, "class", "svelte-17asmgu");
    			add_location(div2, file, 204, 4, 5522);
    			attr_dev(div3, "id", "shopping-cart-section");
    			attr_dev(div3, "class", "svelte-17asmgu");
    			add_location(div3, file, 203, 2, 5485);
    			attr_dev(div4, "id", "main-container");
    			attr_dev(div4, "class", "svelte-17asmgu");
    			add_location(div4, file, 84, 0, 1376);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div0, h20);
    			append_dev(div0, t1);
    			append_dev(div0, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t3);
    			append_dev(ul, li1);
    			append_dev(ul, t5);
    			append_dev(ul, li2);
    			append_dev(div4, t7);
    			append_dev(div4, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, h21);
    			append_dev(div2, t10);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div2, t11);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(div2, t12);
    			if (if_block3) if_block3.m(div2, null);
    			append_dev(div2, t13);
    			if (if_block4) if_block4.m(div2, null);
    			append_dev(div2, t14);
    			if (if_block5) if_block5.m(div2, null);
    			append_dev(div2, t15);
    			if (if_block6) if_block6.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(li0, "click", /*handleCategorySelect*/ ctx[2], false, false, false),
    					listen_dev(li1, "click", /*handleCategorySelect*/ ctx[2], false, false, false),
    					listen_dev(li2, "click", /*handleCategorySelect*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			}

    			if (/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.count) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div2, t11);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_4(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div2, t12);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].baconBrownSauce.count) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block_3(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(div2, t13);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block4, 1);
    					}
    				} else {
    					if_block4 = create_if_block_2(ctx);
    					if_block4.c();
    					transition_in(if_block4, 1);
    					if_block4.m(div2, t14);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block5, 1);
    					}
    				} else {
    					if_block5 = create_if_block_1(ctx);
    					if_block5.c();
    					transition_in(if_block5, 1);
    					if_block5.m(div2, t15);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].pancakeSausageMeal.count) {
    				if (if_block6) {
    					if_block6.p(ctx, dirty);

    					if (dirty & /*$shoppingCart*/ 1) {
    						transition_in(if_block6, 1);
    					}
    				} else {
    					if_block6 = create_if_block(ctx);
    					if_block6.c();
    					transition_in(if_block6, 1);
    					if_block6.m(div2, null);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			transition_in(if_block4);
    			transition_in(if_block5);
    			transition_in(if_block6);
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $shoppingCart;
    	let $shoppingCategory;
    	validate_store(shoppingCart, "shoppingCart");
    	component_subscribe($$self, shoppingCart, $$value => $$invalidate(0, $shoppingCart = $$value));
    	validate_store(shoppingCategory, "shoppingCategory");
    	component_subscribe($$self, shoppingCategory, $$value => $$invalidate(1, $shoppingCategory = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let name = "world!!";

    	function handleCategorySelect(event) {
    		shoppingCategory.set(event.target.id);
    	}

    	function handleAddToCartButton(event) {
    		console.log($shoppingCart.doubleSausageMcmuffin);
    		shoppingCart.update("doubleSausageMcmuffin", n => n + 1);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffin"]["count"]++, $shoppingCart);
    	const click_handler_1 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffinMeal"]["count"]++, $shoppingCart);
    	const click_handler_2 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauce"]["count"]++, $shoppingCart);
    	const click_handler_3 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauceMeal"]["count"]++, $shoppingCart);
    	const click_handler_4 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageSyrup"]["count"]++, $shoppingCart);
    	const click_handler_5 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageMeal"]["count"]++, $shoppingCart);
    	const click_handler_6 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffin"]["count"]--, $shoppingCart);
    	const click_handler_7 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffin"]["count"]++, $shoppingCart);
    	const click_handler_8 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffin"]["isLarge"] = Math.abs($shoppingCart["doubleSausageMcmuffin"]["isLarge"] - 1), $shoppingCart);
    	const click_handler_9 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffinMeal"]["count"]--, $shoppingCart);
    	const click_handler_10 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffinMeal"]["count"]++, $shoppingCart);
    	const click_handler_11 = () => set_store_value(shoppingCart, $shoppingCart["doubleSausageMcmuffinMeal"]["isLarge"] = Math.abs($shoppingCart["doubleSausageMcmuffinMeal"]["isLarge"] - 1), $shoppingCart);
    	const click_handler_12 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauce"]["count"]--, $shoppingCart);
    	const click_handler_13 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauce"]["count"]++, $shoppingCart);
    	const click_handler_14 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauce"]["isLarge"] = Math.abs($shoppingCart["baconBrownSauce"]["isLarge"] - 1), $shoppingCart);
    	const click_handler_15 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauceMeal"]["count"]--, $shoppingCart);
    	const click_handler_16 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauceMeal"]["count"]++, $shoppingCart);
    	const click_handler_17 = () => set_store_value(shoppingCart, $shoppingCart["baconBrownSauceMeal"]["isLarge"] = Math.abs($shoppingCart["baconBrownSauceMeal"]["isLarge"] - 1), $shoppingCart);
    	const click_handler_18 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageSyrup"]["count"]--, $shoppingCart);
    	const click_handler_19 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageSyrup"]["count"]++, $shoppingCart);
    	const click_handler_20 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageSyrup"]["isLarge"] = Math.abs($shoppingCart["pancakeSausageSyrup"]["isLarge"] - 1), $shoppingCart);
    	const click_handler_21 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageMeal"]["count"]--, $shoppingCart);
    	const click_handler_22 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageMeal"]["count"]++, $shoppingCart);
    	const click_handler_23 = () => set_store_value(shoppingCart, $shoppingCart["pancakeSausageMeal"]["isLarge"] = Math.abs($shoppingCart["pancakeSausageMeal"]["isLarge"] - 1), $shoppingCart);

    	$$self.$capture_state = () => ({
    		shoppingCategory,
    		shoppingCart,
    		fade,
    		fly,
    		name,
    		handleCategorySelect,
    		handleAddToCartButton,
    		$shoppingCart,
    		$shoppingCategory
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) name = $$props.name;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		$shoppingCart,
    		$shoppingCategory,
    		handleCategorySelect,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16,
    		click_handler_17,
    		click_handler_18,
    		click_handler_19,
    		click_handler_20,
    		click_handler_21,
    		click_handler_22,
    		click_handler_23
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

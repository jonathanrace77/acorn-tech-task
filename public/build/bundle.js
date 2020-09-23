
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
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
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
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

    /* src/App.svelte generated by Svelte v3.26.0 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (121:47) 
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
    	let t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * 100) / 100 + "";
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let div1;
    	let h31;
    	let t11;
    	let p2;
    	let t13;
    	let p3;
    	let t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * 100) / 100 + "";
    	let t14;
    	let t15;
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
    			t6 = text(t6_value);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "ADD\n            TO CART";
    			t9 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Pancakes & Sausage Meal";
    			t11 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t13 = space();
    			p3 = element("p");
    			t14 = text(t14_value);
    			t15 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			add_location(h2, file, 122, 8, 3648);
    			add_location(h30, file, 124, 10, 3698);
    			add_location(p0, file, 125, 10, 3747);
    			add_location(p1, file, 129, 10, 3901);
    			attr_dev(button0, "id", "pancakeSausageSyrup");
    			add_location(button0, file, 133, 10, 4049);
    			add_location(div0, file, 123, 8, 3682);
    			add_location(h31, file, 140, 10, 4271);
    			add_location(p2, file, 141, 10, 4314);
    			add_location(p3, file, 145, 10, 4468);
    			attr_dev(button1, "id", "pancakeSausageMeal");
    			add_location(button1, file, 149, 10, 4615);
    			attr_dev(div1, "class", "pancakeSausageMeal");
    			add_location(div1, file, 139, 8, 4228);
    			add_location(div2, file, 121, 6, 3634);
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
    			append_dev(div0, t7);
    			append_dev(div0, button0);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t11);
    			append_dev(div1, p2);
    			append_dev(div1, t13);
    			append_dev(div1, p3);
    			append_dev(p3, t14);
    			append_dev(div1, t15);
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
    			if (dirty & /*$shoppingCart*/ 1 && t6_value !== (t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.price * 100) / 100 + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*$shoppingCart*/ 1 && t14_value !== (t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].pancakeSausageMeal.price * 100) / 100 + "")) set_data_dev(t14, t14_value);
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
    		source: "(121:47) ",
    		ctx
    	});

    	return block;
    }

    // (86:44) 
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
    	let t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * 100) / 100 + "";
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let div1;
    	let h31;
    	let t11;
    	let p2;
    	let t13;
    	let p3;
    	let t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * 100) / 100 + "";
    	let t14;
    	let t15;
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
    			t6 = text(t6_value);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "ADD TO\n            CART";
    			t9 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Bacon Roll with Brown Sauce Meal";
    			t11 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t13 = space();
    			p3 = element("p");
    			t14 = text(t14_value);
    			t15 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			add_location(h2, file, 87, 8, 2436);
    			add_location(h30, file, 89, 10, 2483);
    			add_location(p0, file, 90, 10, 2530);
    			add_location(p1, file, 94, 10, 2684);
    			attr_dev(button0, "id", "baconBrownSauce");
    			add_location(button0, file, 98, 10, 2828);
    			add_location(div0, file, 88, 8, 2467);
    			add_location(h31, file, 105, 10, 3043);
    			add_location(p2, file, 106, 10, 3095);
    			add_location(p3, file, 110, 10, 3249);
    			attr_dev(button1, "id", "baconBrownSauceMeal");
    			add_location(button1, file, 114, 10, 3397);
    			attr_dev(div1, "class", "baconBrownSauceMeal");
    			add_location(div1, file, 104, 8, 2999);
    			add_location(div2, file, 86, 6, 2422);
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
    			append_dev(div0, t7);
    			append_dev(div0, button0);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t11);
    			append_dev(div1, p2);
    			append_dev(div1, t13);
    			append_dev(div1, p3);
    			append_dev(p3, t14);
    			append_dev(div1, t15);
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
    			if (dirty & /*$shoppingCart*/ 1 && t6_value !== (t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauce.price * 100) / 100 + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*$shoppingCart*/ 1 && t14_value !== (t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.price * 100) / 100 + "")) set_data_dev(t14, t14_value);
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
    		source: "(86:44) ",
    		ctx
    	});

    	return block;
    }

    // (51:4) {#if $shoppingCategory === 'mcmuffins'}
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
    	let t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * 100) / 100 + "";
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let div1;
    	let h31;
    	let t11;
    	let p2;
    	let t13;
    	let p3;
    	let t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * 100) / 100 + "";
    	let t14;
    	let t15;
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
    			t6 = text(t6_value);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "ADD\n            TO CART";
    			t9 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Double Sausage Egg McMuffin® Meal";
    			t11 = space();
    			p2 = element("p");
    			p2.textContent = "For nutritional and allergen information for our food please visit\n            http://mcdonalds.co.uk/nutrition.";
    			t13 = space();
    			p3 = element("p");
    			t14 = text(t14_value);
    			t15 = space();
    			button1 = element("button");
    			button1.textContent = "ADD\n            TO CART";
    			add_location(h2, file, 52, 8, 1175);
    			add_location(h30, file, 54, 10, 1226);
    			add_location(p0, file, 55, 10, 1278);
    			add_location(p1, file, 59, 10, 1432);
    			attr_dev(button0, "id", "doubleSausageMcmuffin");
    			add_location(button0, file, 63, 10, 1582);
    			add_location(div0, file, 53, 8, 1210);
    			add_location(h31, file, 70, 10, 1815);
    			add_location(p2, file, 71, 10, 1868);
    			add_location(p3, file, 75, 10, 2022);
    			attr_dev(button1, "id", "doubleSausageMcmuffinMeal");
    			add_location(button1, file, 79, 10, 2176);
    			attr_dev(div1, "class", "doubleSausageMcmuffinMeal");
    			add_location(div1, file, 69, 8, 1765);
    			attr_dev(div2, "class", "doubleSausageMcmuffin");
    			add_location(div2, file, 51, 6, 1131);
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
    			append_dev(div0, t7);
    			append_dev(div0, button0);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t11);
    			append_dev(div1, p2);
    			append_dev(div1, t13);
    			append_dev(div1, p3);
    			append_dev(p3, t14);
    			append_dev(div1, t15);
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
    			if (dirty & /*$shoppingCart*/ 1 && t6_value !== (t6_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffin.price * 100) / 100 + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*$shoppingCart*/ 1 && t14_value !== (t14_value = Math.trunc(/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.price * 100) / 100 + "")) set_data_dev(t14, t14_value);
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
    		source: "(51:4) {#if $shoppingCategory === 'mcmuffins'}",
    		ctx
    	});

    	return block;
    }

    // (160:18) {#if $shoppingCart.doubleSausageMcmuffin.count}
    function create_if_block_5(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Double Sausage and Egg McMuffin®";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 160, 6, 4923);
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 164, 6, 5262);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 167, 6, 5385);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 170, 6, 5508);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(160:18) {#if $shoppingCart.doubleSausageMcmuffin.count}",
    		ctx
    	});

    	return block;
    }

    // (175:4) {#if $shoppingCart.doubleSausageMcmuffinMeal.count}
    function create_if_block_4(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Double Sausage and Egg McMuffin®";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 175, 6, 5772);
    			attr_dev(button0, "class", "decrement-button");
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 180, 6, 6152);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 184, 6, 6312);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 187, 6, 6439);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(175:4) {#if $shoppingCart.doubleSausageMcmuffinMeal.count}",
    		ctx
    	});

    	return block;
    }

    // (192:4) {#if $shoppingCart.baconBrownSauce.count}
    function create_if_block_3(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Bacon Roll with Brown Sauce";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 192, 6, 6701);
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 196, 6, 7005);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 199, 6, 7122);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 202, 6, 7239);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(192:4) {#if $shoppingCart.baconBrownSauce.count}",
    		ctx
    	});

    	return block;
    }

    // (207:4) {#if $shoppingCart.baconBrownSauceMeal.count}
    function create_if_block_2(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Bacon Roll with Brown Sauce Meal";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 207, 6, 7485);
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 212, 6, 7835);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 215, 6, 7956);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 218, 6, 8077);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(207:4) {#if $shoppingCart.baconBrownSauceMeal.count}",
    		ctx
    	});

    	return block;
    }

    // (223:4) {#if $shoppingCart.pancakeSausageSyrup.count}
    function create_if_block_1(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Pancakes & Sausage with Syrup";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 223, 6, 8331);
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 227, 6, 8657);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 230, 6, 8778);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 233, 6, 8899);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(223:4) {#if $shoppingCart.pancakeSausageSyrup.count}",
    		ctx
    	});

    	return block;
    }

    // (238:4) {#if $shoppingCart.pancakeSausageMeal.count}
    function create_if_block(ctx) {
    	let p;
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
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Pancakes & Sausage Meal";
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
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
    			add_location(p, file, 238, 6, 9152);
    			attr_dev(button0, "id", "decrement");
    			add_location(button0, file, 243, 6, 9488);
    			attr_dev(button1, "id", "increment");
    			add_location(button1, file, 246, 6, 9608);
    			attr_dev(button2, "id", "isLarge");
    			add_location(button2, file, 249, 6, 9728);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, button1, anchor);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, button2, anchor);

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
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(button1);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(button2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(238:4) {#if $shoppingCart.pancakeSausageMeal.count}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let ul;
    	let li0;
    	let t2;
    	let li1;
    	let t4;
    	let li2;
    	let t6;
    	let div1;
    	let t7;
    	let div2;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
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
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text("Categories area\n    ");
    			ul = element("ul");
    			li0 = element("li");
    			li0.textContent = "McMuffins";
    			t2 = space();
    			li1 = element("li");
    			li1.textContent = "Wraps & Rolls";
    			t4 = space();
    			li2 = element("li");
    			li2.textContent = "Porridge & Pancakes";
    			t6 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t7 = space();
    			div2 = element("div");
    			t8 = text("Shopping cart ");
    			if (if_block1) if_block1.c();
    			t9 = space();
    			if (if_block2) if_block2.c();
    			t10 = space();
    			if (if_block3) if_block3.c();
    			t11 = space();
    			if (if_block4) if_block4.c();
    			t12 = space();
    			if (if_block5) if_block5.c();
    			t13 = space();
    			if (if_block6) if_block6.c();
    			attr_dev(li0, "id", "mcmuffins");
    			add_location(li0, file, 43, 6, 812);
    			attr_dev(li1, "id", "wraps");
    			add_location(li1, file, 44, 6, 884);
    			attr_dev(li2, "id", "porridge");
    			add_location(li2, file, 45, 6, 956);
    			add_location(ul, file, 42, 4, 801);
    			attr_dev(div0, "id", "categories-section");
    			attr_dev(div0, "class", "svelte-zn040e");
    			add_location(div0, file, 40, 2, 747);
    			attr_dev(div1, "id", "shopping-section");
    			attr_dev(div1, "class", "svelte-zn040e");
    			add_location(div1, file, 49, 2, 1053);
    			attr_dev(div2, "id", "shopping-cart-section");
    			attr_dev(div2, "class", "svelte-zn040e");
    			add_location(div2, file, 158, 2, 4818);
    			attr_dev(div3, "id", "main-container");
    			attr_dev(div3, "class", "svelte-zn040e");
    			add_location(div3, file, 39, 0, 719);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div0, ul);
    			append_dev(ul, li0);
    			append_dev(ul, t2);
    			append_dev(ul, li1);
    			append_dev(ul, t4);
    			append_dev(ul, li2);
    			append_dev(div3, t6);
    			append_dev(div3, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, t8);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div2, t9);
    			if (if_block2) if_block2.m(div2, null);
    			append_dev(div2, t10);
    			if (if_block3) if_block3.m(div2, null);
    			append_dev(div2, t11);
    			if (if_block4) if_block4.m(div2, null);
    			append_dev(div2, t12);
    			if (if_block5) if_block5.m(div2, null);
    			append_dev(div2, t13);
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
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(div2, t9);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].doubleSausageMcmuffinMeal.count) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_4(ctx);
    					if_block2.c();
    					if_block2.m(div2, t10);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].baconBrownSauce.count) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_3(ctx);
    					if_block3.c();
    					if_block3.m(div2, t11);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].baconBrownSauceMeal.count) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_2(ctx);
    					if_block4.c();
    					if_block4.m(div2, t12);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].pancakeSausageSyrup.count) {
    				if (if_block5) {
    					if_block5.p(ctx, dirty);
    				} else {
    					if_block5 = create_if_block_1(ctx);
    					if_block5.c();
    					if_block5.m(div2, t13);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*$shoppingCart*/ ctx[0].pancakeSausageMeal.count) {
    				if (if_block6) {
    					if_block6.p(ctx, dirty);
    				} else {
    					if_block6 = create_if_block(ctx);
    					if_block6.c();
    					if_block6.m(div2, null);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);

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

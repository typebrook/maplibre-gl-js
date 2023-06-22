import puppeteer, {Page, Browser} from 'puppeteer';
import st from 'st';
import http from 'http';
import type {Server} from 'http';
import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
import type {AddressInfo} from 'net';

const testWidth = 800;
const testHeight = 600;

let server: Server;
let browser: Browser;
let page: Page;
let map: any;

describe('Browser tests', () => {

    // start server
    beforeAll(async () => {
        server = http.createServer(
            st(process.cwd())
        );
        await new Promise<void>((resolve) => server.listen(resolve));

        browser = await puppeteer.launch({headless: 'new'});

    }, 40000);

    beforeEach(async () => {
        page = await browser.newPage();
        await page.setViewport({width: testWidth, height: testHeight, deviceScaleFactor: 2});

        const port = (server.address() as AddressInfo).port;

        await page.goto(`http://localhost:${port}/test/integration/browser/fixtures/terrain.html`, {waitUntil: 'domcontentloaded'});

        await page.evaluate(() => {
            new Promise<void>((resolve, _reject) => {
                if (map.loaded()) {
                    resolve();
                } else {
                    map.once('load', () => resolve());
                }
            });
        });
    }, 40000);

    test('Load should fire before resize and moveend', async () => {
        const firstFiredEvent = await page.evaluate(() => {
            const map2 = new maplibregl.Map({
                container: 'map',
                style: 'https://demotiles.maplibre.org/style.json',
                center: [10, 10],
                zoom: 10
            });
            return new Promise<string>((resolve, _reject) => {
                map2.once('resize', () => resolve('resize'));
                map2.once('moveend', () => resolve('moveend'));
                map2.once('load', () => resolve('load'));
            });
        });
        expect(firstFiredEvent).toBe('load');
    }, 20000);

    test('Drag to the left', async () => {

        const canvas = await page.$('.maplibregl-canvas');
        const canvasBB = await canvas?.boundingBox();

        // Perform drag action, wait a bit the end to avoid the momentum mode.
        await page.mouse.move(canvasBB!.x, canvasBB!.y);
        await page.mouse.down();
        await page.mouse.move(100, 0);
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.up();

        const center = await page.evaluate(() => {
            return map.getCenter();
        });

        expect(center.lng).toBeCloseTo(-35.15625, 4);
        expect(center.lat).toBeCloseTo(0, 7);
    }, 20000);

    afterEach(async() => {
        page.close();
    }, 40000);

    afterAll(async () => {
        await browser.close();
        if (server) {
            server.close();
        }
    }, 40000);
});

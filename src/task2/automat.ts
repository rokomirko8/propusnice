


import { writeFile } from 'node:fs/promises';

export async function getToken(
    authority: string,
    audience: string,
    clientId: string,
    clientSecret: string,
    scope: string
): Promise<string> {
    const tokenUrl = `${authority.replace(/\/+$/, '')}/oauth/token`;

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience: audience,
            scope: scope,
        }),
    });

    if (!response.ok) {
        throw new Error(`Dohvat tokena nije uspio: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) {
        throw new Error(`Dohvat tokena nije uspio: odgovor ${response.status} ne sadrži access_token`);
    }
    return data.access_token;
}

export async function issuePass(
    url: string,
    token: string,
    name: string,
    document: string
): Promise<void> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, document }),
    });

    if (response.status !== 201) {
        throw new Error(`Izdavanje propusnice nije uspjelo: ${response.status} ${response.statusText}`);
    }

    const location = response.headers.get('Location');
    if (!location) {
        throw new Error(`Izdavanje propusnice: odgovor ${response.status} nema zaglavlje Location`);
    }
    const path = new URL(location, url).pathname.replace(/\/+$/, '');
    const id = decodeURIComponent(path.substring(path.lastIndexOf('/') + 1));
    if (!id) {
        throw new Error(`Izdavanje propusnice: neispravno zaglavlje Location (${location})`);
    }

    const image = Buffer.from(await response.arrayBuffer());
    await writeFile(`${id}.png`, image);
}

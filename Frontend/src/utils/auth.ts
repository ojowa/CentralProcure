// Frontend/InternalFrontend/src/utils/auth.ts

/**
 * Generates a SHA-256 hash of the input string.
 * This is a client-side hashing for password comparison as per backend stored procedure design.
 * NOTE: This approach is generally insecure for password storage. Ideally, passwords should be sent over HTTPS
 * and hashed/salted securely on the backend. This implementation adheres to the existing backend stored procedure's
 * expectation of receiving an already hashed password for direct comparison.
 *
 * @param message The string to hash (e.g., plain-text password).
 * @returns A promise that resolves to the SHA-256 hash in hexadecimal format.
 */
export async function generateSHA256Hash(message: string): Promise<string> {
    // Encode the message as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // Hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

    // Convert ArrayBuffer to Array of bytes
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert bytes to hex string
    const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hexHash;
}

using System.IO;
using NSec.Cryptography;

namespace Astrolune.Desktop.Modules;

public sealed class ModuleSignatureVerifier
{
    // RFC 8032 test vector public key (dev only).
    private static readonly byte[] PublicKeyBytes = Convert.FromBase64String("11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=");
    private static readonly SignatureAlgorithm Algorithm = SignatureAlgorithm.Ed25519;
    private static readonly PublicKey ModulePublicKey = PublicKey.Import(Algorithm, PublicKeyBytes, KeyBlobFormat.RawPublicKey);

    public ModuleSignatureCheck Verify(string manifestPath, string dllPath, string signaturePath, out string? reason)
    {
        reason = null;

        if (!File.Exists(signaturePath))
        {
            reason = "Signature file is missing.";
            return ModuleSignatureCheck.Missing;
        }

        try
        {
            var signatureText = File.ReadAllText(signaturePath).Trim();
            var signature = Convert.FromBase64String(signatureText);
            var payload = BuildPayload(manifestPath, dllPath);

            if (!Algorithm.Verify(ModulePublicKey, payload, signature))
            {
                reason = "Signature is invalid.";
                return ModuleSignatureCheck.Invalid;
            }

            return ModuleSignatureCheck.Valid;
        }
        catch (FormatException)
        {
            reason = "Signature format is invalid.";
            return ModuleSignatureCheck.Invalid;
        }
        catch (Exception ex)
        {
            reason = $"Signature validation failed: {ex.Message}";
            return ModuleSignatureCheck.Error;
        }
    }

    private static byte[] BuildPayload(string manifestPath, string dllPath)
    {
        var manifestBytes = File.ReadAllBytes(manifestPath);
        var dllBytes = File.ReadAllBytes(dllPath);
        var manifestHash = System.Security.Cryptography.SHA256.HashData(manifestBytes);
        var dllHash = System.Security.Cryptography.SHA256.HashData(dllBytes);
        var payload = new byte[manifestHash.Length + dllHash.Length];
        Buffer.BlockCopy(dllHash, 0, payload, 0, dllHash.Length);
        Buffer.BlockCopy(manifestHash, 0, payload, dllHash.Length, manifestHash.Length);
        return payload;
    }
}

public enum ModuleSignatureCheck
{
    Valid,
    Missing,
    Invalid,
    Error
}

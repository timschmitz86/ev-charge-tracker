namespace CarCharge.Api.Models;

public class SessionConflictException : Exception
{
    public Guid? ServerSessionId { get; }
    public Guid? ClientSessionId { get; }
    public string ConflictType { get; }

    public SessionConflictException(
        Guid? serverSessionId,
        Guid? clientSessionId,
        string conflictType = "SESSION_MISMATCH")
        : base($"Session conflict detected: server={serverSessionId}, client={clientSessionId}, type={conflictType}")
    {
        ServerSessionId = serverSessionId;
        ClientSessionId = clientSessionId;
        ConflictType = conflictType;
    }
}

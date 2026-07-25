using CarCharge.Api.Extensions;
using Xunit;

namespace CarCharge.Api.Tests.Extensions;

public class StringExtensionsTests
{
    [Fact]
    public void ToSafeString_RemovesNewLines()
    {
        var input = "line1\nline2\r\nline3";

        var result = input.ToSafeString();

        Assert.Equal("line1line2line3", result);
    }

    [Fact]
    public void ToSafeString_ReturnsEmptyForNull()
    {
        string? input = null;

        var result = input.ToSafeString();

        Assert.Equal(string.Empty, result);
    }
}

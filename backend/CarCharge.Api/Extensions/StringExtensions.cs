namespace CarCharge.Api.Extensions;

public static class StringExtensions
{
    public static string SafeSuffix(this string? value, int length = 4)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value.Length <= length ? value : value[^length..];
    }

    extension(string value)
    {
        public string ToSafeString()
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value.Replace("\r", string.Empty).Replace("\n", string.Empty);
        }
    }
}

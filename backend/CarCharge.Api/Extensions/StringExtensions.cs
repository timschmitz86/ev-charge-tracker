namespace CarCharge.Api.Extensions;

public static class StringExtensions
{
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

using CarCharge.Api.Interfaces;
using CarCharge.Api.Models;
using CarCharge.Api.Services;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddSingleton<ChargingService>();

// Vehicle integration — optional, config-driven
var vehicleConfig = builder.Configuration.GetSection(VehicleIntegrationOptions.SectionName)
    .Get<VehicleIntegrationOptions>() ?? new VehicleIntegrationOptions();

if (vehicleConfig.Enabled)
{
    builder.Services.AddHttpClient<IVehicleDataProvider, RemoteVehicleProvider>(client =>
    {
        client.BaseAddress = new Uri(vehicleConfig.BaseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        UseProxy = false
    });
}
else
{
    builder.Services.AddSingleton<IVehicleDataProvider, DummyVehicleProvider>();
}

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "v1");
    });

    app.MapScalarApiReference();

}


// Force singleton initialization at startup
app.Services.GetRequiredService<ChargingService>();

app.UseCors();
app.MapControllers();

app.Run();

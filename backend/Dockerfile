FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY CarCharge.Api/CarCharge.Api.csproj CarCharge.Api/
RUN dotnet restore CarCharge.Api/CarCharge.Api.csproj
COPY CarCharge.Api/ CarCharge.Api/
WORKDIR /src/CarCharge.Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5000
ENTRYPOINT ["dotnet", "CarCharge.Api.dll"]

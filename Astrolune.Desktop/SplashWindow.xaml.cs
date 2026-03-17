using System.Windows;

namespace Astrolune.Desktop;

public partial class SplashWindow : Window
{
    public SplashWindow(SplashState state)
    {
        InitializeComponent();
        DataContext = state;
    }

    private void OnExitClicked(object sender, RoutedEventArgs e)
    {
        Application.Current?.Shutdown();
    }
}

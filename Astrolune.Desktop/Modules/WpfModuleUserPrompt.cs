using System.Windows;
using System.Windows.Controls;
using Astrolune.Sdk.Modules;

namespace Astrolune.Desktop.Modules;

public sealed class WpfModuleUserPrompt : IModuleUserPrompt
{
    public bool ConfirmUnsignedModule(ModuleManifest manifest)
    {
        const string message = "This module is not officially verified. Continue anyway?";
        return ShowDecisionDialog("Unverified Module", message, "Continue", "Cancel");
    }

    public bool RequestPermissions(ModuleManifest manifest, IReadOnlyCollection<string> permissions)
    {
        if (permissions.Count == 0)
        {
            return true;
        }

        var formatted = string.Join(", ", permissions.OrderBy(p => p));
        var message = $"The module '{manifest.Name}' requests the following permissions:\n\n{formatted}\n\nAllow these permissions?";
        return ShowMessageBox(message, "Module Permissions", MessageBoxButton.YesNo, MessageBoxImage.Question) == MessageBoxResult.Yes;
    }

    public void NotifyUpdateReady(ModuleManifest manifest, Version version)
    {
        var message = $"An update for '{manifest.Name}' ({version}) has been staged. Restart the app to apply it.";
        ShowMessageBox(message, "Module Update Ready", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private static bool ShowDecisionDialog(string title, string message, string acceptText, string cancelText)
    {
        return InvokeOnUi(() =>
        {
            var window = new Window
            {
                Title = title,
                SizeToContent = SizeToContent.WidthAndHeight,
                ResizeMode = ResizeMode.NoResize,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                MinWidth = 420,
                Content = BuildDialogContent(message, acceptText, cancelText)
            };

            var owner = Application.Current?.MainWindow;
            if (owner is not null && owner.IsVisible)
            {
                window.Owner = owner;
            }

            return window.ShowDialog() == true;
        });
    }

    private static UIElement BuildDialogContent(string message, string acceptText, string cancelText)
    {
        var grid = new Grid
        {
            Margin = new Thickness(20)
        };

        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var text = new TextBlock
        {
            Text = message,
            TextWrapping = TextWrapping.Wrap,
            Margin = new Thickness(0, 0, 0, 16)
        };
        Grid.SetRow(text, 0);
        grid.Children.Add(text);

        var buttonPanel = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right
        };

        var acceptButton = new Button
        {
            Content = acceptText,
            MinWidth = 120,
            Margin = new Thickness(0, 0, 8, 0),
            IsDefault = true
        };
        var cancelButton = new Button
        {
            Content = cancelText,
            MinWidth = 120,
            IsCancel = true
        };

        acceptButton.Click += (_, _) =>
        {
            var window = Window.GetWindow(acceptButton);
            if (window is not null)
            {
                window.DialogResult = true;
                window.Close();
            }
        };

        cancelButton.Click += (_, _) =>
        {
            var window = Window.GetWindow(cancelButton);
            if (window is not null)
            {
                window.DialogResult = false;
                window.Close();
            }
        };

        buttonPanel.Children.Add(acceptButton);
        buttonPanel.Children.Add(cancelButton);
        Grid.SetRow(buttonPanel, 1);
        grid.Children.Add(buttonPanel);

        return grid;
    }

    private static MessageBoxResult ShowMessageBox(string message, string title, MessageBoxButton buttons, MessageBoxImage icon)
    {
        return InvokeOnUi(() => MessageBox.Show(message, title, buttons, icon));
    }

    private static T InvokeOnUi<T>(Func<T> action)
    {
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher is null || dispatcher.CheckAccess())
        {
            return action();
        }

        return dispatcher.Invoke(action);
    }
}
